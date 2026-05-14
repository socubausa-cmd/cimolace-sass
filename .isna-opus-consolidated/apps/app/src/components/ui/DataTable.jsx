import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Eye, 
  Edit, 
  Trash2
} from 'lucide-react';

const DataTable = ({ 
  columns, 
  data = [], 
  onEdit, 
  onDelete, 
  onView, 
  searchFields = [],
  actions = true,
  itemsPerPage = 10
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Search Logic
  const filteredData = data.filter(item => {
    if (!searchTerm || searchFields.length === 0) return true;
    return searchFields.some(field => {
      const value = item[field];
      return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
    });
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="premium-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-white/10 hover:bg-transparent">
              {columns.map((col) => (
                <TableHead key={col.key} className="px-6 py-4 font-medium text-gray-400 uppercase text-xs">
                  {col.label}
                </TableHead>
              ))}
              {actions && <TableHead className="px-6 py-4 text-right text-gray-400 uppercase text-xs">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-white/10">
            {paginatedData.length > 0 ? (
              paginatedData.map((item, index) => (
                <TableRow key={index} className="hover:bg-white/5 transition-colors border-none">
                  {columns.map((col) => (
                    <TableCell key={col.key} className="px-6 py-4 whitespace-nowrap text-gray-300">
                      {col.render ? col.render(item[col.key], item) : item[col.key]}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onView && (
                          <Button variant="ghost" size="icon" onClick={() => onView(item)} className="h-8 w-8 hover:text-blue-400 hover:bg-blue-400/10">
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button variant="ghost" size="icon" onClick={() => onEdit(item)} className="h-8 w-8 hover:text-yellow-400 hover:bg-yellow-400/10">
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button variant="ghost" size="icon" onClick={() => onDelete(item)} className="h-8 w-8 hover:text-red-400 hover:bg-red-400/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-8 text-center text-gray-500 h-24">
                  Aucune donnée trouvée
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="text-gray-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-400 px-2">
            Page {currentPage} sur {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="text-gray-300"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default DataTable;