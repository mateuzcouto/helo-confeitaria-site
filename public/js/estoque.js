/* ═══════════════════════════════════════════════════════════════════════
   estoque.js — MÓDULO DE ESTOQUE E PRODUÇÃO (FICHAS TÉCNICAS)
   ═══════════════════════════════════════════════════════════════════════
   Este módulo gerencia toda a lógica de estoque e produção da confeitaria:

   1. Cadastro de INSUMOS (ingredientes comprados — farinha, açúcar, etc.)
   2. FICHAS TÉCNICAS (receitas com lista de insumos + cálculo de custo)
   3. PRODUÇÃO em bateladas (dar baixa no estoque ao produzir)
   4. CUSTOS DE PRODUÇÃO (energia, gás, mão de obra, impostos, fixos)
   5. CONVERSÕES DE UNIDADE (g→kg, ml→L, e conversões personalizadas)
   6. ALERTAS de estoque baixo (quando sobe menos de 20% do comprado)

   Disponibilizado globalmente como window.HeloInventory.
   Expõe o hook useInventoryDomain que centraliza todo o estado e lógica.
   ═══════════════════════════════════════════════════════════════════════ */
window.HeloInventory = (() => {
	/* React hooks injetados globalmente via core-globals.js */
	const { db, getCol, getMetaDoc } = window.HeloApp;

	/* ══════════════════════════════════════════════════════════════════
	   useInventoryDomain — Hook principal do domínio de estoque
	   ══════════════════════════════════════════════════════════════════
	   Recebe: { ingredients } — lista de insumos vindos do Firebase
	   Retorna: todo o estado e funções para gerenciar estoque e produção.

	   Organização interna:
	   - Estados de formulário (novo insumo, nova receita, edição)
	   - Efeito de sincronização com Firebase (custos de produção, conversões)
	   - Cálculo de custos de receita (calcRecipeCosts)
	   - Conversão de unidades (convertWithBuiltins, convertUnits)
	   - APIs de CRUD (criar/editar insumos e receitas)
	   - Produção em bateladas (apiProduceBatch)
	   - Alertas de estoque baixo (lowStockAlerts)
	   ══════════════════════════════════════════════════════════════════ */
	function useInventoryDomain({ ingredients }) {

		/* ════════════════════════════════════════════════════════════════
		   ESTADOS DE FORMULÁRIO — Campos controlados pelo React
		   ════════════════════════════════════════════════════════════════
		   Cada estado controla um campo de formulário na tela do admin.
		   O padrão é: [valor, setValor] = useState(valorInicial).
		   ════════════════════════════════════════════════════════════════ */

		/* ── Formulário de NOVO INSUMO ────────────────────────────────────
		   name: nome do ingrediente (ex: "Farinha de Trigo")
		   totalWeight: peso total comprado (ex: 5000 = 5kg)
		   totalPrice: preço pago (ex: 25.00)
		   unit: unidade base (g, kg, ml, L)
		   category: categoria ('c' = confeitaria, etc.)
		   wasteFactor: % de desperdício (ex: 5 = 5%) */
		const [newIng, setNewIng] = useState({ name: '', totalWeight: '', totalPrice: '', unit: 'g', category: 'c', wasteFactor: 0 });

		/* ── Formulário de NOVA RECEITA (Ficha Técnica) ──────────────────
		   name: nome do produto (ex: "Bolo de Chocolate")
		   sellingPrice: preço de venda
		   includeLabor: incluir custo de mão de obra?
		   type: 'produto' ou outro tipo
		   yield: rendimento (quantas unidades a receita produz)
		   productionHours: horas de produção */
		const [newRecipe, setNewRecipe] = useState({ name: '', sellingPrice: '', includeLabor: true, type: 'produto', yield: 1, productionHours: 1 });

		/* ── Lista de insumos da receita em criação ──────────────────────
		   Cada item: { ingId, name, qty, unit, inputQty, inputUnit, cost, wasteFactor } */
		const [recipeIngredients, setRecipeIngredients] = useState([]);

		/* ── Campos para ADICIONAR insumo à receita nova ──────────────── */
		const [ingSelect, setIngSelect] = useState('');
		const [ingQtySelect, setIngQtySelect] = useState('');
		const [ingUnitSelect, setIngUnitSelect] = useState('g');
		const [ingWasteSelect, setIngWasteSelect] = useState(0);

		/* ── Insumo sendo EDITADO (null = nenhum) ──────────────────────── */
		const [editIng, setEditIng] = useState(null);

		/* ── Receita sendo EDITADA (null = nenhuma) ───────────────────── */
		const [editRecipe, setEditRecipe] = useState(null);

		/* ── Campos para ADICIONAR insumo à receita em edição ─────────── */
		const [editRecipeIngSelect, setEditRecipeIngSelect] = useState('');
		const [editRecipeIngQty, setEditRecipeIngQty] = useState('');
		const [editRecipeIngUnit, setEditRecipeIngUnit] = useState('g');
		const [editRecipeIngWaste, setEditRecipeIngWaste] = useState(0);

		/* ── CUSTOS DE PRODUÇÃO — Configurações globais ──────────────────
		   electricityKwhPrice: preço do kWh de energia elétrica
		   gasKgPrice: preço do kg de gás
		   avgPowerKw: potência média dos equipamentos (kW)
		   gasKgPerHour: consumo de gás por hora (kg/h)
		   laborPercent: % de mão de obra sobre o custo de insumos
		   taxPercent: % de impostos sobre o subtotal
		   fixedPercent: % de custos fixos sobre o subtotal
		   notes: observações livres */
		const [prodInputs, setProdInputs] = useState({
			electricityKwhPrice: 0.95,
			gasKgPrice: 9.5,
			avgPowerKw: 2.2,
			gasKgPerHour: 0.18,
			laborPercent: 20,
			taxPercent: 6,
			fixedPercent: 4,
			notes: '',
		});
		const [inputsSaving, setInputsSaving] = useState(false);

		/* ── CONVERSÕES DE UNIDADE — Personalizadas pelo admin ────────── */
		const [conversions, setConversions] = useState([]);
		const [newConversion, setNewConversion] = useState({ fromUnit: 'g', toUnit: 'kg', factor: '0.001', note: '' });

		/* ── Calculadora de conversão (input do usuário) ──────────────── */
		const [convCalc, setConvCalc] = useState({ amount: '', fromUnit: 'g', toUnit: 'kg' });

		/* ════════════════════════════════════════════════════════════════
		   SINCRONIZAÇÃO COM FIREBASE — Custos de produção e conversões
		   ════════════════════════════════════════════════════════════════
		   Escuta em tempo real (onSnapshot) dois documentos/coleções:
		   - production_inputs: custos de energia, gás, mão de obra, etc.
		   - conversions: conversões de unidade personalizadas

		   Retorna função de cleanup (unsub) para parar de escutar quando
		   o componente desmonta, evitando vazamento de memória.
		   ════════════════════════════════════════════════════════════════ */
		useEffect(() => {
			const unsubInputs = getMetaDoc('production_inputs').onSnapshot((snap) => {
				if (!snap.exists) return;
				const data = snap.data() || {};
				setProdInputs((prev) => ({ ...prev, ...data }));
			});
			const unsubConversions = getCol('conversions').onSnapshot((snap) => {
				setConversions(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
			});
			return () => {
				unsubInputs();
				unsubConversions();
			};
		}, []);

		/* ════════════════════════════════════════════════════════════════
		   CÁLCULO DE CUSTOS DE RECEITA — Coração da ficha técnica
		   ════════════════════════════════════════════════════════════════
		   Recebe: lista de insumos, flag de mão de obra, rendimento, horas
		   Calcula: custo de insumos + mão de obra + energia + gás + impostos + fixos
		   Retorna: objeto com todos os custos detalhados + custo por unidade

		   Fórmula:
		   1. ingredientsCost = soma do custo de cada insumo
		   2. laborCost = ingredientsCost × laborPercent (se incluído)
		   3. energyCost = horas × potência × preço/kWh
		   4. gasCost = horas × consumo/hora × preço/kg
		   5. subtotal = insumos + mão de obra + energia + gás
		   6. taxCost = subtotal × taxPercent
		   7. fixedCost = subtotal × fixedPercent
		   8. totalCost = subtotal + taxCost + fixedCost
		   9. costPerUnit = totalCost / yield (rendimento)
		   ════════════════════════════════════════════════════════════════ */
		const calcRecipeCosts = useCallback((ingredientsList, includeLabor, yieldValue, productionHoursValue) => {
			const ingredientsCost = (ingredientsList || []).reduce((acc, curr) => acc + (Number(curr?.cost) || 0), 0);
			const laborPct = includeLabor ? (Number(prodInputs.laborPercent) || 20) / 100 : 0;
			const laborCost = ingredientsCost * laborPct;
			const productionHours = Number(productionHoursValue) || 1;
			const energyCost = productionHours * (Number(prodInputs.avgPowerKw) || 0) * (Number(prodInputs.electricityKwhPrice) || 0);
			const gasCost = productionHours * (Number(prodInputs.gasKgPerHour) || 0) * (Number(prodInputs.gasKgPrice) || 0);
			const subtotal = ingredientsCost + laborCost + energyCost + gasCost;
			const taxCost = subtotal * ((Number(prodInputs.taxPercent) || 0) / 100);
			const fixedCost = subtotal * ((Number(prodInputs.fixedPercent) || 0) / 100);
			const totalCost = subtotal + taxCost + fixedCost;
			const yieldQty = Number(yieldValue) > 0 ? Number(yieldValue) : 1;
			const costPerUnit = totalCost / yieldQty;
			return { ingredientsCost, laborCost, energyCost, gasCost, taxCost, fixedCost, totalCost, costPerUnit, yieldQty, productionHours, laborPct };
		}, [ingredients, prodInputs]);

		/* ════════════════════════════════════════════════════════════════
		   CONVERSÃO DE UNIDADES — Built-in + Personalizadas
		   ════════════════════════════════════════════════════════════════
		   O sistema converte unidades em 3 níveis:
		   1. Se fromUnit === toUnit → retorna o próprio valor
		   2. Tenta conversão personalizada (do Firebase)
		   3. Tenta conversão built-in (massa, volume, tempo, comprimento)
		   ════════════════════════════════════════════════════════════════ */

		/* ── convertWithBuiltins: Conversões pré-definidas do sistema ────
		   Massa: mg, g, kg (base = gramas)
		   Volume: ml, L (base = mililitros)
		   Tempo: seg, min, h (base = segundos)
		   Comprimento: mm, cm, m (base = milímetros)
		   Retorna null se não encontrar conversão. */
		const convertWithBuiltins = useCallback((amount, fromUnit, toUnit) => {
			if (fromUnit === toUnit) return amount;
			const groups = {
				mass: { mg: 0.001, g: 1, kg: 1000 },
				volume: { ml: 1, L: 1000 },
				time: { seg: 1, min: 60, h: 3600 },
				length: { mm: 1, cm: 10, m: 1000 },
			};
			for (const key of Object.keys(groups)) {
				const group = groups[key];
				if (group[fromUnit] && group[toUnit]) {
					const base = amount * group[fromUnit];
					return base / group[toUnit];
				}
			}
			return null;
		}, []);

		/* ── convertUnits: Conversão completa (personalizada + built-in) ─
		   1. Tenta conversão direta (fromUnit → toUnit) no Firebase
		   2. Tenta conversão reversa (toUnit → fromUnit) invertendo o fator
		   3. Se não encontra, tenta as built-in */
		const convertUnits = useCallback((amount, fromUnit, toUnit) => {
			if (fromUnit === toUnit) return amount;
			const direct = conversions.find((item) => item.fromUnit === fromUnit && item.toUnit === toUnit);
			if (direct && Number(direct.factor) > 0) return amount * Number(direct.factor);
			const reverse = conversions.find((item) => item.fromUnit === toUnit && item.toUnit === fromUnit);
			if (reverse && Number(reverse.factor) > 0) return amount / Number(reverse.factor);
			return convertWithBuiltins(amount, fromUnit, toUnit);
		}, [conversions, convertWithBuiltins]);

		/* ── conversionResult: Resultado da calculadora de conversão ─────
		   Memoizado: só recalcula quando convCalc muda. */
		const conversionResult = useMemo(() => {
			const amount = Number(convCalc.amount);
			if (!Number.isFinite(amount)) return null;
			const result = convertUnits(amount, convCalc.fromUnit, convCalc.toUnit);
			return Number.isFinite(result) ? result : null;
		}, [convCalc, convertUnits]);

		/* ════════════════════════════════════════════════════════════════
		   APIs DE CRUD — Criar, Ler, Atualizar insumos e receitas
		   ════════════════════════════════════════════════════════════════ */

		/* ── apiCreateIngredient: Cadastra novo insumo no Firebase ───────
		   Valida campos obrigatórios, calcula costPerUnit (preço/peso),
           e salva na coleção "ingredients". Estoque inicial = peso comprado. */
		const apiCreateIngredient = useCallback(async () => {
			if (!newIng.name || !newIng.totalWeight || !newIng.totalPrice) return alert('Preencha os dados do insumo.');
			const weight = parseFloat(newIng.totalWeight);
			const price = parseFloat(newIng.totalPrice);
			const costPerUnit = price / weight;
			await getCol('ingredients').add({
				name: newIng.name,
				purchaseQty: weight,
				currentStockQty: weight,
				purchasePrice: price,
				unit: newIng.unit,
				category: newIng.category,
				wasteFactor: parseFloat(newIng.wasteFactor) || 0,
				costPerUnit,
			});
			setNewIng({ name: '', totalWeight: '', totalPrice: '', unit: 'g', category: 'c', wasteFactor: 0 });
			alert('Insumo cadastrado com sucesso!');
		}, [newIng]);

		/* ── handleAddIngredientToRecipe: Adiciona insumo à receita nova ──
		   Converte a quantidade para a unidade base do insumo,
		   calcula o custo (qty × costPerUnit × fator de desperdício),
		   e adiciona à lista recipeIngredients. */
		const handleAddIngredientToRecipe = useCallback(() => {
			if (!ingSelect || !ingQtySelect) return;
			const ing = ingredients.find((item) => item.id === ingSelect);
			if (!ing) return;
			const qtyInput = parseFloat(ingQtySelect);
			const inputUnit = ingUnitSelect || ing.unit;
			const qtyConverted = convertUnits(qtyInput, inputUnit, ing.unit);
			if (!Number.isFinite(qtyConverted)) {
				return alert(`Sem conversão disponível de ${inputUnit} para ${ing.unit}. Cadastre em Conversões.`);
			}
			const waste = parseFloat(ingWasteSelect) || 0;
			const cost = qtyConverted * ing.costPerUnit * (1 + waste / 100);
			setRecipeIngredients((prev) => [...prev, {
				ingId: ing.id,
				name: ing.name,
				qty: qtyConverted,
				unit: ing.unit,
				inputQty: qtyInput,
				inputUnit,
				cost,
				wasteFactor: waste,
			}]);
			setIngSelect('');
			setIngQtySelect('');
			setIngUnitSelect('g');
			setIngWasteSelect(0);
		}, [ingSelect, ingQtySelect, ingredients, ingUnitSelect, ingWasteSelect, convertUnits]);

		/* ── apiCreateRecipe: Salva ficha técnica (receita) no Firebase ───
		   Valida campos, calcula todos os custos via calcRecipeCosts,
		   calcula margem de lucro ((preço - custo) / preço × 100),
		   e salva na coleção "recipes" com todos os dados detalhados. */
		const apiCreateRecipe = useCallback(async () => {
			if (!newRecipe.name || !newRecipe.sellingPrice || recipeIngredients.length === 0) {
				return alert('Preencha nome, preço e adicione pelo menos 1 insumo.');
			}
			const sellingPrice = parseFloat(newRecipe.sellingPrice);
			const costs = calcRecipeCosts(recipeIngredients, newRecipe.includeLabor, newRecipe.yield, newRecipe.productionHours);
			const costPerUnit = costs.costPerUnit;
			const profitMargin = ((sellingPrice - costPerUnit) / sellingPrice) * 100;
			await getCol('recipes').add({
				name: newRecipe.name,
				type: newRecipe.type,
				yield: costs.yieldQty,
				productionHours: costs.productionHours,
				sellingPrice,
				ingredientsCost: costs.ingredientsCost,
				includeLabor: newRecipe.includeLabor,
				laborCost: costs.laborCost,
				laborPercent: (Number(prodInputs.laborPercent) || 20),
				energyCost: costs.energyCost,
				gasCost: costs.gasCost,
				taxCost: costs.taxCost,
				fixedCost: costs.fixedCost,
				taxPercent: Number(prodInputs.taxPercent) || 0,
				fixedPercent: Number(prodInputs.fixedPercent) || 0,
				totalCost: costs.totalCost,
				costPerUnit,
				profitMargin,
				ingredientsList: recipeIngredients,
			});
			setNewRecipe({ name: '', sellingPrice: '', includeLabor: true, type: 'produto', yield: 1, productionHours: 1 });
			setRecipeIngredients([]);
			alert('Ficha Técnica (Receita) salva com sucesso!');
		}, [newRecipe, recipeIngredients]);

		/* ════════════════════════════════════════════════════════════════
		   PRODUÇÃO EM BATELADAS — Dar baixa no estoque ao produzir
		   ════════════════════════════════════════════════════════════════
		   Quando o admin produz um lote de produtos:
		   1. Pergunta quantas unidades deseja produzir
		   2. Calcula o fator de batelada (unidades / rendimento da receita)
		   3. Verifica se há estoque suficiente de cada insumo
		   4. Se sim, usa Firebase Batch para dar baixa em todos de uma vez
		      (batch = operação atômica: ou todas as baixas funcionam, ou nenhuma)
		   5. FieldValue.increment(-neededQty) decrementa o estoque atomicamente
		   ════════════════════════════════════════════════════════════════ */
		const apiProduceBatch = useCallback(async (recipe) => {
			const recipeYield = Number(recipe.yield) || 1;
			const unitsStr = prompt(`Quantas unidades de "${recipe.name}" você deseja produzir?\n\nRendimento da receita: ${recipeYield} unid por batelada.`);
			if (!unitsStr) return;
			const units = parseInt(unitsStr, 10);
			if (isNaN(units) || units <= 0) return alert('Quantidade inválida.');
			const lotFactor = units / recipeYield;
			let hasEnoughStock = true;
			const missingItems = [];
			recipe.ingredientsList.forEach((reqIng) => {
				const dbIng = ingredients.find((item) => item.id === reqIng.ingId);
				const neededQty = reqIng.qty * lotFactor;
				if (!dbIng || dbIng.currentStockQty < neededQty) {
					hasEnoughStock = false;
					missingItems.push(`${reqIng.name} (Precisa: ${neededQty}${reqIng.unit}, Tem: ${dbIng ? dbIng.currentStockQty.toFixed(1) : 0}${reqIng.unit})`);
				}
			});
			if (!hasEnoughStock) {
				alert(`ESTOQUE INSUFICIENTE!\n\nFaltam os seguintes itens:\n${missingItems.join('\n')}`);
				return;
			}
			try {
				const batch = db.batch();
				recipe.ingredientsList.forEach((reqIng) => {
					const neededQty = reqIng.qty * lotFactor;
					const ingRef = getCol('ingredients').doc(reqIng.ingId);
					batch.update(ingRef, {
						currentStockQty: firebase.firestore.FieldValue.increment(-neededQty),
					});
				});
				await batch.commit();
				alert(`Produção de ${units}x "${recipe.name}" registrada!\nFator aplicado: ${lotFactor.toFixed(3)} bateladas.\nEstoque atualizado com sucesso.`);
			} catch (error) {
				console.error('Erro ao dar baixa', error);
				alert('Erro ao processar produção.');
			}
		}, [ingredients, convertUnits]);

		/* ── lowStockAlerts: Insumos com estoque abaixo de 20% ───────────
		   Filtra insumos cujo estoque atual < 20% da quantidade comprada.
		   Usado para mostrar alertas visuais no painel admin. */
		const lowStockAlerts = useMemo(() => {
			if (!ingredients) return [];
			return ingredients.filter((ing) => ing.currentStockQty < (ing.purchaseQty * 0.2));
		}, [ingredients]);

		/* ── updateIngredient: Atualiza insumo existente no Firebase ─────
		   Recalcula costPerUnit e atualiza todos os campos do documento. */
		const updateIngredient = useCallback(async () => {
			if (!editIng || !editIng.name || !editIng.purchaseQty || !editIng.purchasePrice) return alert('Preencha todos os campos.');
			const weight = parseFloat(editIng.purchaseQty);
			const price = parseFloat(editIng.purchasePrice);
			const costPerUnit = price / weight;
			await getCol('ingredients').doc(editIng.id).update({
				name: editIng.name,
				purchaseQty: weight,
				currentStockQty: parseFloat(editIng.currentStockQty),
				purchasePrice: price,
				unit: editIng.unit,
				category: editIng.category || 'c',
				wasteFactor: parseFloat(editIng.wasteFactor) || 0,
				costPerUnit,
			});
			setEditIng(null);
			alert('Insumo atualizado com sucesso!');
		}, [editIng]);

		/* ── handleRemoveIngredientFromRecipe: Remove insumo da receita nova ── */
		const handleRemoveIngredientFromRecipe = useCallback((idx) => {
			setRecipeIngredients((prev) => prev.filter((_, index) => index !== idx));
		}, []);

		/* ── handleAddIngToEditRecipe: Adiciona insumo à receita em edição ──
           Mesma lógica de handleAddIngredientToRecipe, mas para edição. */
		const handleAddIngToEditRecipe = useCallback(() => {
			if (!editRecipeIngSelect || !editRecipeIngQty) return;
			const ing = ingredients.find((item) => item.id === editRecipeIngSelect);
			if (!ing) return;
			const qtyInput = parseFloat(editRecipeIngQty);
			const inputUnit = editRecipeIngUnit || ing.unit;
			const qtyConverted = convertUnits(qtyInput, inputUnit, ing.unit);
			if (!Number.isFinite(qtyConverted)) {
				return alert(`Sem conversão disponível de ${inputUnit} para ${ing.unit}. Cadastre em Conversões.`);
			}
			const waste = parseFloat(editRecipeIngWaste) || 0;
			const cost = qtyConverted * ing.costPerUnit * (1 + waste / 100);
			setEditRecipe((prev) => ({
				...prev,
				ingredientsList: [...prev.ingredientsList, {
					ingId: ing.id,
					name: ing.name,
					qty: qtyConverted,
					unit: ing.unit,
					inputQty: qtyInput,
					inputUnit,
					cost,
					wasteFactor: waste,
				}],
			}));
			setEditRecipeIngSelect('');
			setEditRecipeIngQty('');
			setEditRecipeIngUnit('g');
			setEditRecipeIngWaste(0);
		}, [editRecipeIngSelect, editRecipeIngQty, ingredients, editRecipeIngUnit, editRecipeIngWaste, convertUnits]);

		/* ── handleRemoveIngFromEditRecipe: Remove insumo da receita em edição ── */
		const handleRemoveIngFromEditRecipe = useCallback((idx) => {
			setEditRecipe((prev) => ({
				...prev,
				ingredientsList: prev.ingredientsList.filter((_, index) => index !== idx),
			}));
		}, []);

		/* ── updateRecipe: Atualiza ficha técnica existente no Firebase ───
           Recalcula todos os custos e margem, e salva na coleção "recipes". */
		const updateRecipe = useCallback(async () => {
			if (!editRecipe || !editRecipe.name || !editRecipe.sellingPrice || editRecipe.ingredientsList.length === 0) {
				return alert('Preencha nome, preço e adicione insumos.');
			}
			const sellingPrice = parseFloat(editRecipe.sellingPrice);
			const costs = calcRecipeCosts(editRecipe.ingredientsList, editRecipe.includeLabor, editRecipe.yield, editRecipe.productionHours);
			const costPerUnit = costs.costPerUnit;
			const profitMargin = ((sellingPrice - costPerUnit) / sellingPrice) * 100;
			await getCol('recipes').doc(editRecipe.id).update({
				name: editRecipe.name,
				type: editRecipe.type || 'produto',
				yield: costs.yieldQty,
				productionHours: costs.productionHours,
				sellingPrice,
				ingredientsCost: costs.ingredientsCost,
				includeLabor: editRecipe.includeLabor || false,
				laborCost: costs.laborCost,
				laborPercent: (Number(prodInputs.laborPercent) || 20),
				energyCost: costs.energyCost,
				gasCost: costs.gasCost,
				taxCost: costs.taxCost,
				fixedCost: costs.fixedCost,
				taxPercent: Number(prodInputs.taxPercent) || 0,
				fixedPercent: Number(prodInputs.fixedPercent) || 0,
				totalCost: costs.totalCost,
				costPerUnit,
				profitMargin,
				ingredientsList: editRecipe.ingredientsList,
			});
			setEditRecipe(null);
			alert('Ficha Técnica atualizada com sucesso!');
		}, [editRecipe]);

		/* ── saveProductionInputs: Salva custos de produção no Firebase ────
		   Converte vírgulas para pontos (formato brasileiro → numérico),
		   e salva no documento "production_inputs" com merge (não sobrescreve). */
		const saveProductionInputs = useCallback(async () => {
			setInputsSaving(true);
			try {
				const payload = Object.fromEntries(Object.entries(prodInputs).map(([key, value]) => [key, Number(String(value || '0').replace(',', '.')) || 0]));
				await getMetaDoc('production_inputs').set({ ...payload, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
				alert('Custos de produção atualizados!');
			} catch (error) {
				console.error('Erro ao salvar custos de produção:', error);
				alert('Não foi possível salvar os custos de produção.');
			} finally {
				setInputsSaving(false);
			}
		}, [prodInputs]);

		/* ── addConversion: Cadastra conversão personalizada no Firebase ──
		   Valida: fromUnit ≠ toUnit, fator > 0.
           Ex: xícara → ml com fator 240 (1 xícara = 240ml) */
		const addConversion = useCallback(async () => {
			const factor = Number(newConversion.factor);
			if (!newConversion.fromUnit || !newConversion.toUnit || !Number.isFinite(factor) || factor <= 0) {
				return alert('Preencha origem, destino e fator válido (> 0).');
			}
			if (newConversion.fromUnit === newConversion.toUnit) {
				return alert('Origem e destino devem ser diferentes.');
			}
			await getCol('conversions').add({
				fromUnit: newConversion.fromUnit,
				toUnit: newConversion.toUnit,
				factor,
				note: String(newConversion.note || ''),
				createdAt: firebase.firestore.FieldValue.serverTimestamp(),
			});
			setNewConversion({ fromUnit: 'g', toUnit: 'kg', factor: '0.001', note: '' });
		}, [newConversion]);

		/* ════════════════════════════════════════════════════════════════
		   EXPORTAÇÃO — Tudo que o hook retorna para a interface usar
		   ════════════════════════════════════════════════════════════════ */
		return {
			newIng,
			setNewIng,
			newRecipe,
			setNewRecipe,
			recipeIngredients,
			setRecipeIngredients,
			ingSelect,
			setIngSelect,
			ingQtySelect,
			setIngQtySelect,
			ingUnitSelect,
			setIngUnitSelect,
			ingWasteSelect,
			setIngWasteSelect,
			editIng,
			setEditIng,
			editRecipe,
			setEditRecipe,
			editRecipeIngSelect,
			setEditRecipeIngSelect,
			editRecipeIngQty,
			setEditRecipeIngQty,
			editRecipeIngUnit,
			setEditRecipeIngUnit,
			editRecipeIngWaste,
			setEditRecipeIngWaste,
			prodInputs,
			setProdInputs,
			inputsSaving,
			conversions,
			newConversion,
			setNewConversion,
			convCalc,
			setConvCalc,
			calcRecipeCosts,
			convertWithBuiltins,
			convertUnits,
			conversionResult,
			apiCreateIngredient,
			handleAddIngredientToRecipe,
			handleRemoveIngredientFromRecipe,
			handleAddIngToEditRecipe,
			handleRemoveIngFromEditRecipe,
			apiCreateRecipe,
			apiProduceBatch,
			lowStockAlerts,
			updateIngredient,
			updateRecipe,
			saveProductionInputs,
			addConversion,
		};
	}

	/* ── Exporta o hook no namespace global ──────────────────────────── */
	return {
		useInventoryDomain,
	};
})();
