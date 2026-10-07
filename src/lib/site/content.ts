/**
 * Authored storefront copy.
 *
 * Everything here is factual and supplied: prices, product features and
 * testimonials come from the KMD Empire design document. Claims that the
 * document does not support are deliberately absent — in particular the
 * Dokudami capsule copy stays inside food-supplement language and links to the
 * published Houttuynia cordata review as further reading rather than asserting
 * an outcome.
 */

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface PolicySection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export const DOKUDAMI_REVIEW_URL = "https://www.mdpi.com/1424-8247/15/9/1079";

export const SUPPLEMENT_DISCLAIMER =
  "This product is a food supplement. It is not intended to diagnose, treat, cure or prevent any disease. Individual results may vary.";

export const POWERPILL_DISCLAIMER =
  "Performance results may vary depending on engine condition, fuel quality, vehicle type, maintenance practices and operating conditions.";

/**
 * Published testimonials.
 *
 * The design document also supplies a testimonial describing a cancer outcome.
 * It is intentionally not reproduced anywhere in this codebase: promotional
 * use of a disease-treatment outcome is not something this site publishes.
 */
export const TESTIMONIALS = [
  {
    quote:
      "Power Pill Plus helped improve my vehicle's performance. Indeed a legit product and highly recommended.",
    name: "Glavys Gavenia",
    location: "Pagadian City, Philippines",
    subject: "PowerPill Plus",
  },
  {
    quote:
      "The Emergency LED Bulb gave us peace of mind during power outages. Highly recommended!",
    name: "Hon. Obed Tshilomboji Muyumbe",
    location: "Democratic Republic of Congo",
    subject: "Intelligent Emergency LED Bulb",
  },
  {
    quote:
      "I like the website design that KMD is servicing me now. Great service indeed for my business.",
    name: "Kez",
    location: "KMD digital client",
    subject: "Website & Landing Page Service",
  },
] as const;

export const COMPANY = {
  name: "KMD Empire",
  legalParent: "Eco and Green Choyce International, Inc.",
  tagline: "Serving with purpose, integrity, and excellence.",
  poweredBy: "KMD Empire Team is powered by GreenChoyce.",
  positioning: "Sustainable Innovation for Health, Home & Everyday Living",
  website: "www.kmdempire.com",
  intro:
    "We are committed to delivering innovative, problem-solving products that enrich everyday life through quality, sustainability, and exceptional value. From premium wellness solutions to eco-friendly home and lifestyle essentials, every product is carefully selected to promote healthier living while contributing to a more sustainable future.",
  mission:
    "To develop and provide innovative, sustainable, and high-quality products that solve everyday challenges while creating a positive impact on people and the environment.",
  vision:
    "To build a future where innovation and sustainability go hand in hand, delivering products that improve lives while protecting our planet. Because there is no Planet B.",
  aboutVision:
    "Guided by innovation and customer trust, our vision is to become a leading one-stop destination for health, home, and everyday living — bringing together world-class products that inspire better lifestyles, create lasting value, and make sustainable choices more accessible to every family and community we serve.",
  parentBlurb:
    "GreenChoyce is a multi-award-winning international Swiss company with offices in the Philippines and Switzerland, committed to delivering innovative, high-quality, and environmentally responsible solutions to customers around the world.",
  phones: ["+63 995 861 2854", "+63 975 398 9689"],
  emails: ["dan08.skywalker@gmail.com", "taksman11@gmail.com"],
  social: {
    facebook: "https://www.facebook.com/dokudamiphilippines/",
    youtube: "https://www.youtube.com/@ecoandgreenchoyce",
    tiktok: "https://www.tiktok.com/@danderek08",
    instagram: "https://www.instagram.com/dan_derek08",
  },
} as const;

export const DOKUDAMI_FEATURES = [
  "Made with Houttuynia cordata (dokudami) and its naturally occurring compounds",
  "Flavonoids, essential oil, alkaloids, phenolic acid and fatty acids",
  "Plant-based capsule formula",
  "No artificial colours or flavours",
] as const;

export const POWERPILL_BENEFITS = [
  "Helps support fuel efficiency",
  "Supports cleaner and more efficient combustion",
  "Helps reduce carbon deposits that build up in the engine",
  "Supports smoother engine performance",
  "One pill treats up to the labelled litres of fuel",
] as const;

export const LED_BULB_FEATURES = [
  "Automatic emergency lighting when mains power fails",
  "Rechargeable battery with up to 7 hours of backup power",
  "Energy-saving LED technology — 5 W output equivalent to a 60 W bulb",
  "5-year warranty",
] as const;

export const CLOSET_FEATURES = [
  "Soft, breathable fabric for all-day comfort",
  "Elegant, timeless silhouette",
  "Everyday pricing",
] as const;

export const DIGITAL_SERVICES = [
  "Website Development",
  "Landing Pages",
  "Business & E-Commerce Websites",
  "Mobile App Development",
  "Digital Solutions for Your Business",
] as const;

export const FAQS: FaqEntry[] = [
  {
    question: "Do I need an account to place an order?",
    answer:
      "No. You can check out as a guest with just your name, mobile number and email address, and your order confirmation is sent straight to you. Members can sign in instead and the order is linked to their account so it appears in their order history.",
  },
  {
    question: "How do I pay for my order?",
    answer:
      "After you place your order you are shown the available payment options — GCash, Maya, Maya Bank and bank transfer. Send your payment to the account shown, then upload a photo or PDF of your receipt on the checkout page. Nothing is charged automatically.",
  },
  {
    question: "What happens after I upload my proof of payment?",
    answer:
      "Your order is marked as awaiting payment verification and our team reviews the receipt against the amount due. Once it is verified your order status changes to confirmed and, if you are a member, your Unilevel rewards are posted at the same moment. You can follow all of this from the order tracking page.",
  },
  {
    question: "How much is delivery, and where do you deliver?",
    answer:
      "We deliver across Luzon, Visayas and Mindanao. The delivery fee for your area is shown at checkout before you pay. Digital services such as website development have no delivery fee.",
  },
  {
    question: "Can I return an item?",
    answer:
      "Yes. If an item arrives damaged, faulty or is not what you ordered, contact us within 7 days of delivery and we will arrange a replacement or a refund. See the Return & Refund Policy for the full process and the exceptions.",
  },
  {
    question: "Are the Dokudami Capsules a medicine?",
    answer:
      "No. Dokudami Capsules are a food supplement made with Houttuynia cordata. They are not intended to diagnose, treat, cure or prevent any disease, and individual results may vary. If you are pregnant, nursing, taking medication or managing a health condition, please speak with your doctor before use.",
  },
  {
    question: "What is the Unilevel plan?",
    answer:
      "Members earn Unilevel points when a purchase in their registered sponsor chain is paid and confirmed — up to five levels up from the buyer. The value paid at each level is configured per product by the administrator, and every payment is written to a permanent ledger so balances always agree with the history. A purchase earns nothing until payment is confirmed.",
  },
  {
    question: "How do I become a member?",
    answer:
      "Register from the Become a Member page. If a member shared their referral link with you, open that link and your sponsor is locked in automatically so your placement in the plan is correct from day one.",
  },
  {
    question: "Can I order a website or landing page?",
    answer:
      "Yes. The Website & Landing Page Service is in the shop like any other product. Add it to your cart and check out; after your payment is verified we contact you to agree the scope, content and timeline before any work begins.",
  },
  {
    question: "I paid but my order still says awaiting verification. What now?",
    answer:
      "Verification is done by a person, so it is not instant. Use the order tracking page with your order number and the email address or mobile number you ordered with, and contact us if it has been longer than one working day.",
  },
];

export const PRIVACY_POLICY: PolicySection[] = [
  {
    heading: "What we collect",
    paragraphs: [
      "When you place an order we collect the details needed to fulfil it: your name, mobile number, email address, delivery address and the items you ordered. We record the payment method you selected and the proof of payment you upload.",
      "When you register as a member we additionally record your username, your sponsor or referral code, and the compensation activity generated by purchases in your sponsor chain.",
    ],
  },
  {
    heading: "Why we collect it",
    paragraphs: [
      "To process and deliver your order, to verify your payment, to provide support when you contact us, and to operate the member compensation plan for members who have joined it.",
    ],
  },
  {
    heading: "Payment details",
    paragraphs: [
      "We never ask for your card number, bank login or one-time passwords. Payment is made by you directly to the published account, and the only thing we store is the proof of payment you send us and the reference number you provide.",
    ],
  },
  {
    heading: "Who can see your data",
    paragraphs: [
      "Order and payment details are visible to the KMD Empire staff who process orders, and to you through your order tracking page or member dashboard. Member genealogy is visible only to you, your upline and your downline within the five-level plan, and to administrators.",
      "We do not sell or rent your personal information.",
    ],
  },
  {
    heading: "How long we keep it",
    paragraphs: [
      "Order, payment and compensation records are kept as long as needed to operate the business and to satisfy accounting and tax obligations. Compensation ledger entries are permanent by design: corrections are made by posting an offsetting entry rather than by deleting history.",
    ],
  },
  {
    heading: "Your choices",
    paragraphs: [
      "You can ask us to correct your contact details at any time, and a member can update their own profile from the member dashboard. To request a copy of your data or ask for your account to be closed, contact us using the details on the Contact page.",
    ],
  },
];

export const TERMS: PolicySection[] = [
  {
    heading: "Using this site",
    paragraphs: [
      "By placing an order or registering as a member you confirm that the information you give us is accurate and that you are able to enter into a contract.",
    ],
  },
  {
    heading: "Orders and pricing",
    paragraphs: [
      "Prices shown are the promotional prices currently published for each item, alongside the regular price. An order is only accepted once your payment has been verified; until then the order is a request. If an item becomes unavailable we will contact you and refund or replace it.",
      "Where a price appears to be published in error we may cancel the affected order and return any payment in full rather than fulfil it at the incorrect price.",
    ],
  },
  {
    heading: "Payment",
    paragraphs: [
      "Payment is made by transferring funds to one of the published accounts and uploading proof of that payment. Orders are not dispatched until the payment has been verified against the amount due.",
    ],
  },
  {
    heading: "Delivery",
    paragraphs: [
      "Delivery times are estimates and are not guaranteed. The delivery fee for your area is shown at checkout before you pay. Risk in the goods passes to you on delivery.",
    ],
  },
  {
    heading: "Digital services",
    paragraphs: [
      "The Website & Landing Page Service is delivered to an agreed scope. After your payment is verified we agree the scope, content, timeline and number of revision rounds with you in writing before work begins. Work outside the agreed scope is quoted separately.",
    ],
  },
  {
    heading: "Member compensation",
    paragraphs: [
      "Compensation is earned only when a purchase is paid and confirmed. Values are configured per product and level by the administrator and are visible to members on their own reward records. Participating in the plan does not create an employment relationship, and no income is guaranteed.",
    ],
  },
  {
    heading: "Product statements",
    paragraphs: [
      "Dokudami Capsules are a food supplement. They are not intended to diagnose, treat, cure or prevent any disease, and individual results may vary. Statements published on this site about ingredients describe the ingredient itself and are not a claim about an outcome for any individual.",
    ],
  },
  {
    heading: "Changes",
    paragraphs: [
      "We may update these terms as the business changes. The version in force is the one published on this page when you place your order.",
    ],
  },
];

export const REFUND_POLICY: PolicySection[] = [
  {
    heading: "The 7-day window",
    paragraphs: [
      "Contact us within 7 days of receiving your delivery if an item arrives damaged, is faulty, is not what you ordered, or is short-shipped. Claims made after that window may still be considered, but the 7-day window is what we commit to.",
    ],
  },
  {
    heading: "What to send us",
    paragraphs: [
      "Send your order number and a short description of the problem, with photographs of the item and its packaging where relevant. We will confirm the next step in writing.",
    ],
  },
  {
    heading: "How we resolve it",
    paragraphs: [
      "Where the claim is accepted we replace the item, or refund it if a replacement is not available. Approved refunds are returned through the same channel you paid with.",
    ],
  },
  {
    heading: "What is not covered",
    paragraphs: [
      "Change of mind after an item has shipped, normal wear, damage caused after delivery, and orders where the payment cannot be matched to a verified proof of payment.",
    ],
  },
  {
    heading: "Digital services",
    paragraphs: [
      "Because a website or landing page is created specifically for you, the service fee is not refundable once work has started. If you cancel before work begins, we refund the fee in full. If we are unable to deliver the agreed scope, the undelivered portion is refunded.",
    ],
  },
  {
    heading: "Food supplements",
    paragraphs: [
      "Sealed supplement products may be returned unopened within the 7-day window. Opened supplement products cannot be returned for hygiene reasons unless the seal was already broken on arrival.",
    ],
  },
];

export interface KnowledgeGuide {
  slug: string;
  title: string;
  summary: string;
  bullets: string[];
  external?: { label: string; url: string };
}

export const KNOWLEDGE_GUIDES: KnowledgeGuide[] = [
  {
    slug: "understanding-houttuynia-cordata",
    title: "Understanding Houttuynia cordata, the dokudami botanical",
    summary:
      "Dokudami Capsules are made with Houttuynia cordata. This guide explains what the botanical is and points you to the peer-reviewed literature if you want to read the science for yourself.",
    bullets: [
      "Dokudami is the Japanese name for Houttuynia cordata, a plant that also appears in traditional preparations across East and Southeast Asia.",
      "The compounds that appear most often in the literature are flavonoids, essential oil, alkaloids, phenolic acid and fatty acids.",
      "Published research describes the plant and its constituents. It is educational reading and is not evidence that a supplement can diagnose, treat, cure or prevent any disease.",
    ],
    external: {
      label: "Pharmacological Effects of Houttuynia cordata: A Comprehensive Review",
      url: DOKUDAMI_REVIEW_URL,
    },
  },
  {
    slug: "reading-a-supplement-label",
    title: "How to read a food-supplement label",
    summary:
      "A short guide to the parts of a supplement label that actually tell you something, so you can decide for yourself.",
    bullets: [
      "The serving size tells you what the rest of the numbers refer to.",
      "The ingredient list is ordered by quantity, and any declared plant extract should say how much extract it contains.",
      "'Food supplement' is a regulatory category: it means the product is not a medicine and must not be presented as one.",
      "Check for allergens and for anything you avoid, then speak to your doctor if you are pregnant, nursing, taking medication or managing a health condition.",
    ],
  },
  {
    slug: "how-payment-verification-works",
    title: "How payment verification works",
    summary:
      "Why your order says 'awaiting payment verification' and exactly what happens next.",
    bullets: [
      "You place the order and choose a payment method, and the site shows you the account to pay.",
      "You send the payment, then upload a photo or PDF of the receipt on the same page.",
      "Our staff compare the receipt with the amount due and either confirm the order or ask you for a new proof.",
      "Stock is only taken off the shelf when the payment is confirmed, and only then are member rewards posted.",
    ],
  },
  {
    slug: "how-the-unilevel-plan-works",
    title: "How the five-level Unilevel plan works",
    summary:
      "A plain-language explanation of how a purchase turns into points across five levels.",
    bullets: [
      "A purchase earns nothing on its own. Rewards are released only when the payment is confirmed.",
      "When it is confirmed the system traces upward from the buyer through the registered sponsor chain and pays each eligible level.",
      "The value paid at each level is configured per product by the administrator, so a product with no configured values pays nothing.",
      "Every payment is written to a permanent ledger and every entry carries an idempotency key, so the same purchase can never be paid twice.",
    ],
  },
  {
    slug: "choosing-emergency-lighting",
    title: "Choosing an emergency light for power outages",
    summary:
      "What to look at when you want a bulb that keeps working when the mains power drops.",
    bullets: [
      "Backup time is measured from a full charge, so how long the bulb lasts depends on how long it charged and how bright you run it.",
      "A wattage equivalence figure such as '5 W equivalent to 60 W' describes light output, not how much power it draws.",
      "Look for the warranty length and how the bulb is charged before you commit.",
    ],
  },
];

export const HOMEPAGE_CATEGORIES = [
  { name: "Wellness", blurb: "Everyday food-supplement support.", slug: "wellness" },
  { name: "Fuel Additive", blurb: "Keep engines cleaner and running smoother.", slug: "fuel-additive" },
  { name: "Home & Lighting", blurb: "Stay lit when the power goes out.", slug: "home-lighting" },
  { name: "Apparel", blurb: "Comfortable clothing at everyday prices.", slug: "apparel" },
  { name: "Digital Services", blurb: "Websites, landing pages and apps for your business.", slug: "digital-services" },
] as const;

export const TRUST_SIGNALS = [
  { title: "Verified payments", detail: "Every payment is checked by a person against the amount due before an order is confirmed." },
  { title: "Real stock control", detail: "Stock is reserved when you order and only leaves the shelf once payment is verified." },
  { title: "Ledger-backed rewards", detail: "Member rewards are written to a permanent ledger, so balances always match the history." },
  { title: "Nationwide delivery", detail: "Luzon, Visayas and Mindanao, with the delivery fee shown before you pay." },
] as const;
