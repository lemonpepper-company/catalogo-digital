import {
  MessagesSquare,
  RefreshCw,
  Store,
  Image as ImageIcon,
  MessageCircle,
  Link as LinkIcon,
  Package,
  Smartphone,
  BarChart3,
} from "lucide-react";

export const painCards = [
  {
    icon: <MessagesSquare size={22} className="text-obsidian" />,
    title: "Catálogo no chat se perde",
    desc: "Mandar foto por foto cansa o cliente e some no histórico de conversas. Nada fica organizado.",
  },
  {
    icon: <RefreshCw size={22} className="text-obsidian" />,
    title: "Preço e estoque desatualizados",
    desc: "Atualizar tabela no Excel e reenviar a cada conversa é trabalhoso — e gera mal-entendido na hora da venda.",
  },
  {
    icon: <Store size={22} className="text-obsidian" />,
    title: "Sua loja parece amadora",
    desc: "Sem uma vitrine própria, é difícil passar a imagem de marca que o seu produto realmente tem.",
  },
];

export const steps = [
  {
    num: "01",
    title: "Cadastre seus produtos",
    desc: "Adicione foto, nome, preço, tamanhos e descrição. Em poucos minutos sua vitrine começa a tomar forma.",
  },
  {
    num: "02",
    title: "Personalize sua loja",
    desc: "Nome, número de WhatsApp e identidade. Tudo com a cara da sua marca, do jeito boutique.",
  },
  {
    num: "03",
    title: "Compartilhe o link",
    desc: "Copie e cole na bio, no status ou no grupo. O cliente compra e a conversa cai direto no seu WhatsApp.",
  },
];

export const features = [
  {
    icon: <ImageIcon size={20} />,
    title: "Vitrine editorial",
    desc: "Layout limpo e premium que valoriza cada peça. Nada de cara de marketplace.",
  },
  {
    icon: <MessageCircle size={20} />,
    title: "Checkout no WhatsApp",
    desc: 'O botão "Comprar" abre uma mensagem pronta com produto, tamanho e quantidade.',
  },
  {
    icon: <LinkIcon size={20} />,
    title: "Link único da loja",
    desc: "Um endereço só seu para colocar na bio e compartilhar onde quiser.",
  },
  {
    icon: <Package size={20} />,
    title: "Controle de estoque",
    desc: "Marque o que esgotou e mantenha a vitrine sempre certa, sem retrabalho.",
  },
  {
    icon: <Smartphone size={20} />,
    title: "Pensado no celular",
    desc: "Seus clientes compram pelo telefone — e tudo é desenhado para essa tela.",
  },
  {
    icon: <BarChart3 size={20} />,
    title: "Painel simples",
    desc: "Gerencie produtos e veja o que está ativo em um painel direto ao ponto.",
  },
];

export const testimonials = [
  {
    quote:
      '"Minhas clientes elogiam o link toda semana. Parece site de loja grande, mas montei sozinha em uma tarde."',
    initial: "M",
    name: "Mariana Reis",
    role: "Ateliê Mira · Moda feminina",
  },
  {
    quote:
      '"Parei de mandar foto por foto. Agora é só o link, e a venda já chega no WhatsApp com tudo certinho."',
    initial: "C",
    name: "Camila Souza",
    role: "Loja Camé · Acessórios",
  },
  {
    quote:
      '"O visual é o que mais me conquistou. Minha marca finalmente tem a vitrine que ela merecia."',
    initial: "J",
    name: "Juliana Alves",
    role: "Studio JA · Calçados",
  },
];

export const starterFeatures = [
  "Até 30 produtos",
  "Link único da loja",
  "Checkout no WhatsApp",
  "Painel do lojista",
];

export const proFeatures = [
  "Produtos ilimitados",
  "Controle de estoque",
  "Categorias e destaques",
  "Personalização da marca",
  "Suporte prioritário",
];

export const faqs = [
  {
    q: "Preciso de maquininha ou gateway de pagamento?",
    a: "Não. O pagamento é combinado com você direto no WhatsApp, como já acontece hoje. A Vtrine cuida da vitrine e leva o cliente até a conversa — você fecha do seu jeito.",
  },
  {
    q: "Meus clientes precisam baixar algum aplicativo?",
    a: 'Nenhum. O cliente abre o link no navegador do celular, navega pela loja e toca em "Comprar". Cai no WhatsApp com a mensagem pronta. Simples assim.',
  },
  {
    q: "Consigo montar minha loja sozinha?",
    a: "Sim. O painel foi feito para ser direto: você cadastra produtos, define preços e tamanhos e publica. A maioria dos lojistas coloca a vitrine no ar no mesmo dia.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Quando quiser, sem multa. Você começa no plano grátis e só assina um plano pago se decidir que vale a pena para o tamanho da sua loja.",
  },
];

export const phoneMockProducts = [
  { name: "Blusa Linho", price: "R$ 189,90" },
  { name: "Vestido Midi", price: "R$ 249,90" },
  { name: "Saia Plissada", price: "R$ 159,90" },
  { name: "Camisa Seda", price: "R$ 279,90" },
];
