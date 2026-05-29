import React, { useState } from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Ban, Eye, Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import CertificateTemplate from './CertificateTemplate';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

const OwnerCertificatesManagement = () => {
  const { certificates, revokeCertificate, addCertificate } = useDataSync();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);

  const filtered = certificates.filter(c => 
     c.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     c.certificateNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateMock = () => {
    addCertificate({
       studentId: 'new-1',
       studentName: 'Nouvel Élève',
       title: 'Formation Complète - 2025',
       type: 'formation',
       issueDate: new Date().toISOString(),
       status: 'valid',
       certificateNumber: `CERT-${Date.now()}`
    });
  };

  const stats = {
    total: certificates.length,
    valid: certificates.filter((c) => c.status === 'valid').length,
    revoked: certificates.filter((c) => c.status !== 'valid').length,
  };

  return (
    <div className="space-y-6">
       <motion.div
         initial={{ opacity: 0, y: -8 }}
         animate={{ opacity: 1, y: 0 }}
         className="flex justify-between items-center"
       >
          <h2 className="text-2xl font-bold text-white">Gestion des Certificats</h2>
          <Button onClick={handleGenerateMock} className="bg-[#D4AF37] text-black hover:bg-yellow-500">
             <Plus className="w-4 h-4 mr-2" /> Générer Certificat
          </Button>
       </motion.div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         {[
           { label: 'Total certificats', value: stats.total, color: 'text-white' },
           { label: 'Valides', value: stats.valid, color: 'text-green-400' },
           { label: 'Revoques', value: stats.revoked, color: 'text-red-400' },
         ].map((item, index) => (
           <motion.div key={item.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} whileHover={{ y: -2 }}>
             <Card className="premium-panel border-white/10">
               <CardContent className="p-4">
                 <p className="text-gray-400 text-xs uppercase">{item.label}</p>
                 <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
               </CardContent>
             </Card>
           </motion.div>
         ))}
       </div>

       <Card className="premium-panel border-white/10">
          <div className="p-4 border-b border-white/10 flex items-center gap-4">
             <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                   type="text"
                   placeholder="Rechercher un certificat..."
                   className="w-full bg-[#0F1419] border border-white/10 rounded-md pl-9 pr-4 py-2 text-sm text-white"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
          {certificates.length === 0 ? (
            <CardContent className="p-10 text-center">
              <Eye className="w-8 h-8 text-[#D4AF37] mx-auto mb-3" />
              <p className="text-white font-semibold">Aucun certificat généré</p>
              <p className="text-gray-400 text-sm mt-1">Génère ton premier certificat pour démarrer.</p>
              <Button onClick={handleGenerateMock} className="mt-4 bg-[#D4AF37] text-black hover:bg-[#c4a030]">
                <Plus className="w-4 h-4 mr-2" /> Générer le premier certificat
              </Button>
            </CardContent>
          ) : (
          <Table>
             <TableHeader className="bg-[#0F1419]">
                <TableRow className="border-white/10 hover:bg-transparent">
                   <TableHead className="text-gray-400">Numéro</TableHead>
                   <TableHead className="text-gray-400">Étudiant</TableHead>
                   <TableHead className="text-gray-400">Intitulé</TableHead>
                   <TableHead className="text-gray-400">Date</TableHead>
                   <TableHead className="text-gray-400">Statut</TableHead>
                   <TableHead className="text-gray-400 text-right">Actions</TableHead>
                </TableRow>
             </TableHeader>
             <TableBody>
                {filtered.length === 0 ? (
                  <TableRow className="border-white/5">
                    <TableCell colSpan={6} className="text-center py-10 text-gray-400">
                      Aucun résultat pour cette recherche.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((cert) => (
                   <TableRow key={cert.id} className="border-white/5 hover:bg-white/5 transition-colors">
                      <TableCell className="font-mono text-sm text-gray-300">{cert.certificateNumber}</TableCell>
                      <TableCell className="font-medium text-white">{cert.studentName}</TableCell>
                      <TableCell className="text-gray-300">{cert.title}</TableCell>
                      <TableCell className="text-gray-400 text-sm">{format(new Date(cert.issueDate), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                         <Badge className={cert.status === 'valid' ? 'bg-green-500' : 'bg-red-500'}>
                            {cert.status === 'valid' ? 'Valide' : 'Révoqué'}
                         </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                         <div className="flex justify-end gap-2">
                            <Dialog>
                               <DialogTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400" onClick={() => setSelectedCert(cert)}>
                                     <Eye className="w-4 h-4" />
                                  </Button>
                               </DialogTrigger>
                               <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
                                 <DialogHeader className="sr-only">
                                   <DialogTitle>Certificat</DialogTitle>
                                 </DialogHeader>
                                  {selectedCert && (
                                     <div className="w-full aspect-[1.414/1] bg-white rounded-lg overflow-hidden">
                                        <CertificateTemplate 
                                           studentName={selectedCert.studentName}
                                           title={selectedCert.title}
                                           date={selectedCert.issueDate}
                                           certificateNumber={selectedCert.certificateNumber}
                                        />
                                     </div>
                                  )}
                               </DialogContent>
                            </Dialog>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white">
                               <Download className="w-4 h-4" />
                            </Button>
                            {cert.status === 'valid' && (
                               <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => revokeCertificate(cert.id)}>
                                  <Ban className="w-4 h-4" />
                               </Button>
                            )}
                         </div>
                      </TableCell>
                   </TableRow>
                ))}
             </TableBody>
          </Table>
          )}
       </Card>
    </div>
  );
};

export default OwnerCertificatesManagement;