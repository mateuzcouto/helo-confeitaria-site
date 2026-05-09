/* ═══════════════════════════════════════════════════════════════════════
   carrinho.js — LÓGICA DO CARRINHO DE COMPRAS
   ═══════════════════════════════════════════════════════════════════════
   Este arquivo contém as "funções-gancho" (React Hooks) que controlam
   tudo que acontece no carrinho da loja:

   1. useCart()         → Gerencia os itens do carrinho (adicionar, remover, limpar)
   2. useSpecialClient() → Verifica se o cliente é VIP (gastou acima do limite este mês)
   3. useOrderTotal()    → Calcula o valor total do pedido com descontos e frete

   Essas funções são "hooks" do React — funções especiais que guardam
   estado (dados que mudam com o tempo) e re-renderizam a tela
   automaticamente quando algo muda.

   O arquivo é exposto globalmente como window.HeloCart para que outros
   arquivos possam usar essas funções sem precisar importar.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── IIFE (Immediately Invoked Function Expression) ────────────────────
   A função é executada logo que o arquivo carrega. Tudo que está dentro
   dela fica "privado" — só o que está no "return" fica visível para fora.
   Isso evita que variáveis internas vazejam e causem conflitos com outros
   arquivos do projeto.
   ──────────────────────────────────────────────────────────────────── */
window.HeloCart = (() => {

	/* ── Desestruturação dos hooks do React ────────────────────────────
	   React nos dá várias funções para gerenciar estado e efeitos.
	   Aqui pegamos só as que vamos usar:

	   - useState    → Cria uma variável de estado (dado que muda com o tempo)
	   - useEffect   → Roda um efeito colateral (ex: buscar dados no banco)
	   - useMemo     → Guarda um cálculo em cache (só refaz se as entradas mudarem)
	   - useCallback → Guarda uma função em cache (evita recriar a cada render)
	   - useRef      → Guarda um valor que NÃO causa re-render quando muda
	   ──────────────────────────────────────────────────────────────── */
	/* React hooks injetados globalmente via core-globals.js */

	/* ── Importação de constantes e funções do app.js ──────────────────
	   O arquivo app.js (window.HeloApp) centraliza as configurações do
	   sistema. Aqui pegamos:

	   - safeText       → Função que transforma qualquer valor em texto seguro
	                       (evita erros quando o valor é null ou undefined)
	   - DELIVERY_FEE   → Valor da taxa de entrega (ex: R$ 3,00)
	   - VIP_THRESHOLD  → Quanto o cliente precisa gastar para ser VIP (ex: R$ 300)
	   - VIP_DISCOUNT   → Percentual de desconto VIP (ex: 10% = 0.10)
	   ──────────────────────────────────────────────────────────────── */
	const {
		safeText,
		DELIVERY_FEE,
		VIP_THRESHOLD,
		VIP_DISCOUNT,
	} = window.HeloApp;

	/* ══════════════════════════════════════════════════════════════════
	   useCart() — HOOK DO CARRINHO DE COMPRAS
	   ══════════════════════════════════════════════════════════════════
	   Esta função gerencia tudo relacionado ao carrinho:
	   - Quais produtos estão no carrinho
	   - Quantos de cada produto
	   - O subtotal (soma de preço × quantidade)
	   
	   Retorna um objeto com:
	   - cart      → Lista de itens no carrinho
	   - addToCart → Função para adicionar um produto
	   - updateQty → Função para mudar a quantidade (+1 ou -1)
	   - clearCart → Função para esvaziar o carrinho
	   - subtotal  → Valor total dos itens (sem frete/desconto)
	   ══════════════════════════════════════════════════════════════════ */
	function useCart() {

		/* ── Estado do carrinho ──────────────────────────────────────────
		   useState([]) cria uma variável "cart" que começa como lista vazia.
		   "setCart" é a função para alterar essa lista.
		   Cada item do carrinho tem: { id, name, price, qty, ...outros campos }
		   ──────────────────────────────────────────────────────────────── */
		const [cart, setCart] = useState([]);

		/* ── addToCart: Adiciona um produto ao carrinho ─────────────────
		   Se o produto JÁ EXISTE no carrinho → aumenta a quantidade em +1
		   Se o produto É NOVO → adiciona com qty: 1

		   Por que useCallback? Para que a função não seja recriada a cada
		   renderização, o que poderia causar renders desnecessários nos
		   componentes filhos que recebem essa função como prop.
		   ──────────────────────────────────────────────────────────────── */
		const addToCart = useCallback((product) => setCart((prev) => {
			const existing = prev.find((item) => item.id === product.id);
			return existing
				? prev.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
				: [...prev, { ...product, qty: 1 }];
		}), []);

		/* ── updateQty: Altera a quantidade de um item ──────────────────
		   Recebe o ID do produto e um "delta" (mudança: +1 ou -1).
		   - Se a quantidade ficar 0 ou menos → o item é removido do carrinho
		   - Math.max(0, ...) garante que a quantidade nunca fica negativa
		   - .filter(item => item.qty > 0) remove itens com quantidade zero

		   Exemplo: updateQty('p1', -1) diminui 1 unidade do produto p1
		   ──────────────────────────────────────────────────────────────── */
		const updateQty = useCallback((id, delta) => setCart((prev) =>
			prev.map((item) => item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item).filter((item) => item.qty > 0)
		), []);

		/* ── clearCart: Esvazia o carrinho completamente ────────────────
		   Simplesmente seta o carrinho de volta para lista vazia [].
		   Usado após o cliente finalizar o pedido.
		   ──────────────────────────────────────────────────────────────── */
		const clearCart = useCallback(() => setCart([]), []);

		/* ── subtotal: Soma total dos itens (sem frete e sem desconto) ──
		   useMemo calcula o subtotal SOMENTE quando o carrinho muda.
           Fórmula: para cada item → preço × quantidade → soma tudo.

		   Por que useMemo? Se o carrinho não mudou, o React reutiliza
		   o valor calculado anteriormente em vez de recalcular.
		   Isso melhora a performance do app.
		   ──────────────────────────────────────────────────────────────── */
		const subtotal = useMemo(() => cart.reduce((acc, item) => acc + Number(item.price) * Number(item.qty), 0), [cart]);

		/* ── Retorna tudo que os outros componentes precisam ──────────── */
		return { cart, addToCart, updateQty, clearCart, subtotal };
	}

	/* ══════════════════════════════════════════════════════════════════
	   useSpecialClient() — HOOK DE CLIENTE VIP
	   ══════════════════════════════════════════════════════════════════
	   Verifica se o cliente é "especial" (VIP) baseado no quanto ele
	   já gastou em pedidos CONCLUÍDOS neste mês.

	   Como funciona:
	   1. Pega o telefone do cliente
	   2. Busca todos os pedidos concluídos desse telefone
	   3. Soma o total gasto no mês atual
	   4. Se a soma for >= VIP_THRESHOLD (ex: R$ 300) → é VIP

	   Parâmetros:
	   - phone  → Telefone do cliente (ex: "88981577625")
	   - orders → Lista de todos os pedidos do sistema

	   Retorna: true (é VIP) ou false (não é VIP)
	   ══════════════════════════════════════════════════════════════════ */
	function useSpecialClient(phone, orders) {

		/* ── Estado: o cliente é VIP ou não? ────────────────────────────
		   Começa como false e muda para true se o gasto mensal for suficiente.
		   ──────────────────────────────────────────────────────────────── */
		const [isSpecial, setIsSpecial] = useState(false);

		/* ── Referência para o temporizador (debounce) ──────────────────
		   useRef guarda o ID do setTimeout sem causar re-render.
		   Usamos isso para "esperar um pouco" antes de verificar,
		   evitando fazer a verificação a cada tecla digitada.
		   ──────────────────────────────────────────────────────────────── */
		const timer = useRef(null);

		useEffect(() => {

			/* ── Debounce: limpa o timer anterior e cria um novo ──────────
			   Se o usuário está digitando o telefone, não queremos verificar
			   a cada letra. Esperamos 400ms sem digitar para então verificar.
			   Isso é chamado de "debounce" — uma técnica muito comum em
			   formulários web para melhorar a performance.
			   ──────────────────────────────────────────────────────────── */
			clearTimeout(timer.current);
			timer.current = setTimeout(() => {

				/* ── Limpa o telefone: remove tudo que não é dígito ────────
				   Ex: "(88) 98157-7625" vira "88981577625"
				   \D significa "tudo que NÃO é dígito (0-9)"
				   ──────────────────────────────────────────────────────── */
				const num = String(phone || '').replace(/\D/g, '');

				/* ── Telefone muito curto? Não é válido ───────────────────
				   Se tem menos de 10 dígitos, não dá para identificar o
				   cliente, então marcamos como não-VIP e saímos.
				   ──────────────────────────────────────────────────────── */
				if (num.length < 10) {
					setIsSpecial(false);
					return;
				}

				/* ── Pega os últimos 8 dígitos como "identificador" ────────
				   Usamos só os últimos 8 porque o DDD pode variar na
				   forma como o cliente digita. Ex: "88981577625" → "98157625"
				   ──────────────────────────────────────────────────────── */
				const target = num.slice(-8);

				/* ── Data atual para comparar o mês ─────────────────────── */
				const now = new Date();

				/* ── Soma o total gasto em pedidos concluídos este mês ────
				   Percorre TODOS os pedidos e, para cada um:
				   1. Verifica se o telefone bate com o do cliente
				   2. Verifica se o status é "Concluído"
				   3. Verifica se o pedido foi criado no mês atual
				   4. Se tudo bater, soma o valor do pedido ao acumulador
				   ──────────────────────────────────────────────────────── */
				const spend = orders.reduce((acc, order) => {
					try {
						/* Se o pedido não tem telefone, pula */
						if (!order?.customerPhone) return acc;

						/* Limpa o telefone do pedido para comparar */
						const orderPhone = String(order.customerPhone).replace(/\D/g, '');

						/* Normaliza o status: remove acentos e converte para minúsculo
						   "Concluído" → "concluido" (sem acento) para poder comparar */
						const status = safeText(order.status).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

						/* Se o telefone não bate OU o status não é "concluído", pula */
						if (orderPhone.slice(-8) !== target || status !== 'concluido') return acc;

						/* ── Converte a data de criação do pedido ──────────────
						   O Firebase guarda datas de duas formas:
						   - Timestamp com .toDate() → método do Firebase
						   - Objeto com .seconds → formato serializado
						   Ambos são convertidos para um objeto Date do JavaScript.
						   ──────────────────────────────────────────────────── */
						let createdDate = null;
						if (typeof order.createdAt?.toDate === 'function') createdDate = order.createdAt.toDate();
						else if (order.createdAt?.seconds) createdDate = new Date(order.createdAt.seconds * 1000);

						/* ── Verifica se o pedido é do mês atual ──────────────
						   Compara mês e ano da data do pedido com "agora".
						   Se for do mesmo mês, soma o valor total ao acumulador.
						   ──────────────────────────────────────────────────── */
						if (createdDate && !isNaN(createdDate) && createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear()) {
							return acc + (Number(order.total) || 0);
						}
					} catch {
						/* Se der qualquer erro neste pedido, ignora e continua */
						return acc;
					}
					return acc;
				}, 0);

				/* ── Verifica se atingiu o limite VIP ──────────────────────
				   Se o total gasto (spend) for maior ou igual ao limite
				   (VIP_THRESHOLD, ex: R$ 300), o cliente é VIP!
				   ──────────────────────────────────────────────────────── */
				setIsSpecial(spend >= VIP_THRESHOLD);
			}, 400); /* 400ms de debounce — espera o usuário parar de digitar */

			/* ── Cleanup: limpa o timer quando o componente desmonta ──────
			   Isso evita vazamento de memória (memory leak). Se o usuário
			   sai da tela antes dos 400ms, o timer é cancelado.
			   ──────────────────────────────────────────────────────────── */
			return () => clearTimeout(timer.current);
		}, [phone, orders]); /* Roda novamente quando phone ou orders mudam */

		return isSpecial;
	}

	/* ══════════════════════════════════════════════════════════════════
	   useOrderTotal() — HOOK DE CÁLCULO DO TOTAL DO PEDIDO
	   ══════════════════════════════════════════════════════════════════
	   Calcula o valor final que o cliente vai pagar, considerando:
	   - Subtotal (soma dos itens)
	   - Desconto (cupom ou VIP)
	   - Frete (taxa de entrega, se for entrega)

	   Parâmetros:
	   - subtotal     → Soma dos itens (vem do useCart)
	   - method       → "entrega" ou "retirada"
	   - coupon       → Objeto do cupom (se houver): { type, value }
	   - isVip        → Se o cliente é VIP (vem do useSpecialClient)
	   - deliveryFee  → Taxa de entrega (opcional, padrão = DELIVERY_FEE)

	   Tipos de cupom:
	   - "percent"      → Desconto de X% sobre o subtotal
	   - "fixed"        → Desconto de R$ X fixo
	   - "free_shipping"→ Frete grátis (zera a taxa de entrega)

	   Retorna: { discountValue, finalDelivery, total, specialApplied }
	   ══════════════════════════════════════════════════════════════════ */
	function useOrderTotal(subtotal, method, coupon, isVip, deliveryFee = DELIVERY_FEE) {
		return useMemo(() => {

			/* ── Valor do desconto (começa zerado) ─────────────────────── */
			let discountValue = 0;

			/* ── Garante que a taxa de entrega é um número válido ────────
			   Number(deliveryFee) || 0 → se for NaN ou undefined, usa 0 */
			const normalizedDeliveryFee = Number(deliveryFee) || 0;

			/* ── Frete: só cobra se o método for "entrega" ───────────────
			   Se o cliente escolheu "retirada", o frete é zero. */
			let finalDelivery = method === 'entrega' ? normalizedDeliveryFee : 0;

			/* ── Flag: o desconto veio do VIP? (para mostrar na tela) ──── */
			let specialApplied = false;

			/* ── Aplica desconto: cupom tem prioridade sobre VIP ─────────
			   Se o cliente tem cupom → aplica o cupom
			   Se não tem cupom mas é VIP → aplica desconto VIP */
			if (coupon) {
				/* Cupom de percentual: ex: 10% de desconto */
				if (coupon.type === 'percent') discountValue = subtotal * (Number(coupon.value) / 100);
				/* Cupom de valor fixo: ex: R$ 20 de desconto */
				else if (coupon.type === 'fixed') discountValue = Number(coupon.value);
				/* Cupom de frete grátis: zera a taxa de entrega */
				else if (coupon.type === 'free_shipping') finalDelivery = 0;
			} else if (isVip) {
				/* Desconto VIP: percentual sobre o subtotal */
				discountValue = subtotal * VIP_DISCOUNT;
				specialApplied = true;
			}

			/* ── Retorna o cálculo completo ──────────────────────────────
			   - discountValue  → Quanto foi descontado
			   - finalDelivery  → Valor do frete final
			   - total          → Subtotal - desconto + frete (nunca negativo)
			   - specialApplied → Se o desconto veio do programa VIP
			   Math.max(0, ...) garante que o total nunca fica negativo,
			   mesmo se o desconto for maior que o subtotal.
			   ──────────────────────────────────────────────────────────── */
			return {
				discountValue,
				finalDelivery,
				total: Math.max(0, subtotal - discountValue + finalDelivery),
				specialApplied,
			};
		}, [subtotal, method, coupon, isVip, deliveryFee]);
		/* useMemo: só recalcula quando algum desses valores mudar */
	}

	/* ══════════════════════════════════════════════════════════════════
	   EXPORTAÇÃO — O que fica disponível para outros arquivos
	   ══════════════════════════════════════════════════════════════════
	   Só estas três funções ficam acessíveis via window.HeloCart:
	   - useCart          → Gerencia itens do carrinho
	   - useSpecialClient → Verifica se o cliente é VIP
	   - useOrderTotal    → Calcula total com descontos e frete
	   ══════════════════════════════════════════════════════════════════ */
	return {
		useCart,
		useSpecialClient,
		useOrderTotal,
	};
})();
