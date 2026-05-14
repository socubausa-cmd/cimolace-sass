import { Navigate, useParams } from 'react-router-dom';

/** Alias mobile vers la fiche produit canonique /product/:id */
export default function MobileProductScreen() {
  const { id } = useParams();
  if (!id) return <Navigate to="/boutique" replace />;
  return <Navigate to={`/product/${id}`} replace />;
}
