import { subDays, addDays, format } from 'date-fns';

const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const generateFinancialData = (students = []) => {
  // Inventory Data
  const categories = ['Fournitures', 'Équipements', 'Livres', 'Autres'];
  const inventory = Array.from({ length: 25 }).map((_, i) => ({
    id: `inv-${i + 1}`,
    name: `Article ${i + 1}`,
    description: `Description pour article ${i + 1}`,
    category: random(categories),
    quantity: randomInt(0, 100),
    minQuantity: randomInt(5, 20),
    unitPrice: randomInt(5, 150),
    supplier: `Fournisseur ${String.fromCharCode(65 + randomInt(0, 5))}`,
    dateAdded: subDays(new Date(), randomInt(1, 200)).toISOString(),
    schoolYear: '2024-2025',
    status: 'active'
  }));

  // Invoices Data
  const invoiceStatuses = ['paid', 'pending', 'overdue'];
  const invoices = Array.from({ length: 60 }).map((_, i) => {
    const student = random(students) || { id: 'unknown', name: 'Étudiant Inconnu' };
    const amount = randomInt(100, 2000);
    const status = random(invoiceStatuses);
    const paidAmount = status === 'paid' ? amount : (status === 'pending' ? randomInt(0, amount / 2) : 0);
    
    return {
      id: `invc-${i + 1}`,
      invoiceNumber: `FACT-${2024000 + i}`,
      studentId: student.id,
      studentName: student.name,
      totalAmount: amount,
      paidAmount: paidAmount,
      pendingAmount: amount - paidAmount,
      status: status,
      issueDate: subDays(new Date(), randomInt(1, 100)).toISOString(),
      dueDate: addDays(new Date(), randomInt(1, 30)).toISOString(),
      description: `Frais de scolarité - Trimestre ${randomInt(1, 3)}`,
      schoolYear: '2024-2025'
    };
  });

  // Payments Data
  const paymentMethods = ['Virement', 'Carte bancaire', 'Espèces', 'Chèque', 'Mobile money'];
  const paymentStatuses = ['confirmed', 'pending', 'rejected'];
  const payments = Array.from({ length: 80 }).map((_, i) => {
    const student = random(students) || { id: 'unknown', name: 'Étudiant Inconnu' };
    return {
      id: `pay-${i + 1}`,
      paymentNumber: `PAY-${2024000 + i}`,
      studentId: student.id,
      studentName: student.name,
      amount: randomInt(50, 1000),
      method: random(paymentMethods),
      status: random(paymentStatuses),
      date: subDays(new Date(), randomInt(0, 60)).toISOString(),
      reference: `REF-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      description: 'Paiement partiel',
      schoolYear: '2024-2025'
    };
  });

  return { inventory, invoices, payments };
};