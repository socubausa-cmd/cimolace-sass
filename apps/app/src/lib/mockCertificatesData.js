import { subDays } from 'date-fns';

export const generateCertificates = (students) => {
  return Array.from({ length: 15 }).map((_, i) => ({
    id: `cert-${i + 1}`,
    studentId: students[i % students.length]?.id || 'stu-1',
    studentName: students[i % students.length]?.name || 'Étudiant Inconnu',
    title: i % 2 === 0 ? "Cycle Fondamental - Année 1" : "Atelier Maîtrise Avancée",
    type: i % 2 === 0 ? "formation" : "workshop",
    issueDate: subDays(new Date(), i * 5).toISOString(),
    status: 'valid',
    certificateNumber: `CERT-${2024000 + i}`,
    url: '#'
  }));
};