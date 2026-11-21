import "server-only";
export function getBankTransferInstructions() {
  const bankName = process.env.PAYMENT_BANK_NAME;
  const accountName = process.env.PAYMENT_ACCOUNT_NAME;
  const accountNumber = process.env.PAYMENT_ACCOUNT_NUMBER;
  const instructions = process.env.PAYMENT_INSTRUCTIONS;
  if (!bankName || !accountName || !accountNumber || !instructions) throw new Error("BANK_DETAILS_NOT_CONFIGURED");
  if (!/^\d{10}$/.test(accountNumber)) throw new Error("INVALID_BANK_ACCOUNT_NUMBER");
  return { bankName, accountName, accountNumber, instructions };
}
