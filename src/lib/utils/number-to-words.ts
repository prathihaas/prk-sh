// Indian English number-to-words converter
// Handles Indian grouping: Crore → Lakh → Thousand → Hundred
// Example: 15,23,456 → "Fifteen Lakh Twenty Three Thousand Four Hundred Fifty Six"

const ones: string[] = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const tens: string[] = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

/**
 * Convert a number 0–99 to words.
 */
function convertTwoDigit(n: number): string {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return tens[t] + (o ? " " + ones[o] : "");
}

/**
 * Convert a number 0–999 to words.
 */
function convertHundreds(n: number): string {
  if (n === 0) return "";
  if (n < 100) return convertTwoDigit(n);

  const h = Math.floor(n / 100);
  const remainder = n % 100;
  let result = ones[h] + " Hundred";
  if (remainder > 0) {
    result += " " + convertTwoDigit(remainder);
  }
  return result;
}

/**
 * Convert a non-negative integer to Indian English words.
 * Uses Indian numbering: Crore (10^7), Lakh (10^5), Thousand (10^3).
 *
 * @example numberToWords(1523456) → "Fifteen Lakh Twenty Three Thousand Four Hundred Fifty Six"
 * @example numberToWords(0) → "Zero"
 */
export function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  if (n < 0) return "Minus " + numberToWords(Math.abs(n));

  const num = Math.floor(n);
  const parts: string[] = [];

  // Crore portion (groups of 2 above lakh)
  const crore = Math.floor(num / 10000000);
  if (crore > 0) {
    // Recursively handle crore (can be multi-digit: "Nine Hundred Ninety Nine Crore")
    parts.push(convertHundreds(crore) + " Crore");
  }

  // Lakh portion (2 digits)
  const lakh = Math.floor((num % 10000000) / 100000);
  if (lakh > 0) {
    parts.push(convertTwoDigit(lakh) + " Lakh");
  }

  // Thousand portion (2 digits)
  const thousand = Math.floor((num % 100000) / 1000);
  if (thousand > 0) {
    parts.push(convertTwoDigit(thousand) + " Thousand");
  }

  // Hundreds + remainder (3 digits)
  const remainder = num % 1000;
  if (remainder > 0) {
    parts.push(convertHundreds(remainder));
  }

  return parts.join(" ");
}

/**
 * Convert a monetary amount to Indian English words with Rupees/Paise.
 *
 * @example amountToIndianWords(15000) → "Rupees Fifteen Thousand Only"
 * @example amountToIndianWords(15234.50) → "Rupees Fifteen Thousand Two Hundred Thirty Four and Fifty Paise Only"
 * @example amountToIndianWords(0) → "Rupees Zero Only"
 */
export function amountToIndianWords(amount: number): string {
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  let result = "Rupees " + numberToWords(rupees);

  if (paise > 0) {
    result += " and " + numberToWords(paise) + " Paise";
  }

  result += " Only";

  return result;
}
