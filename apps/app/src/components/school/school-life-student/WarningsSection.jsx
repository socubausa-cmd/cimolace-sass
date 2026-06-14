import React from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const WarningsSection = ({ data }) => {
  const activeCount = data.filter(w => w.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex items-center gap-4">
        <div className="p-3 bg-red-500/20 rounded-full text-red-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Avertissements & Signalements</h2>
          <p className="text-gray-400">Vous avez <strong className="text-red-400">{activeCount}</strong> avertissement(s) actif(s).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((warning) => (
          <Card key={warning.id} className={`bg-[#192734] border-white/10 ${warning.status === 'active' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-green-500 opacity-75'}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                 <Badge variant="outline" className={warning.status === 'active' ? "text-red-400 border-red-400/30" : "text-green-400 border-green-400/30"}>
                    {warning.type}
                 </Badge>
                 {warning.status === 'active' ? <Clock className="w-4 h-4 text-red-400" /> : <CheckCircle className="w-4 h-4 text-green-400" />}
              </div>
              <CardTitle className="text-base text-white mt-2">
                {warning.reason}
              </CardTitle>
            </CardHeader>
            <CardContent>
               <p className="text-sm text-gray-400 mb-2">
                 Date: {format(new Date(warning.date), 'dd MMMM yyyy', { locale: fr })}
               </p>
               <p className="text-xs uppercase tracking-wider font-bold text-gray-500">
                 Statut: {warning.status === 'active' ? 'Non Résolu' : 'Résolu'}
               </p>
            </CardContent>
          </Card>
        ))}
        {data.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 italic">
            Aucun avertissement. Félicitations pour votre comportement exemplaire !
          </div>
        )}
      </div>
    </div>
  );
};

export default WarningsSection;