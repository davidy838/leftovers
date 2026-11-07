const RULES: [RegExp, string][] = [
  [/pizza/i, "🍕"],
  [/sandwich|sub\b|wrap/i, "🥪"],
  [/sushi/i, "🍣"],
  [/donut|doughnut/i, "🍩"],
  [/cookie/i, "🍪"],
  [/cake|cupcake|dessert|pastr/i, "🍰"],
  [/coffee|tea\b|latte/i, "☕"],
  [/bagel/i, "🥯"],
  [/burrito/i, "🌯"],
  [/taco/i, "🌮"],
  [/salad|veggie tray|vegetable/i, "🥗"],
  [/noodle|ramen|pasta/i, "🍜"],
  [/rice|curry|biryani/i, "🍛"],
  [/fruit|apple|banana|orange/i, "🍎"],
  [/burger/i, "🍔"],
  [/chip|snack/i, "🍿"],
];

export function foodEmoji(text: string): string {
  for (const [re, e] of RULES) if (re.test(text)) return e;
  return "🍱";
}
