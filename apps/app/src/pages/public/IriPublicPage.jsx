/**
 * Page publique IRI — contenu 100% dynamique depuis `iri-page` (tenant = Host).
 * URL : /p/:slug  (ex. /p/accueil sur cimolace.prorascience.org)
 */

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { fetchIriPage } from '@/lib/iri/loadIriPage';

const IriBlockRenderer = lazy(() => import('@/components/iri/IriBlockRenderer'));

export default function IriPublicPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchIriPage(slug || '', { forceRefresh: false })
      .then((d) => {
        if (cancelled) return;
        if (!d) {
          setData(null);
          setError(new Error('Page introuvable ou non publiée.'));
        } else {
          setData(d);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const title = data?.page?.title || slug || 'Page';
  const blocks = data?.blocks || [];

  return (
    <div className="min-h-screen bg-[#050507] text-white px-4 py-8 max-w-3xl mx-auto">
      <Helmet>
        <title>{title}</title>
        {data?.page?.meta?.description ? (
          <meta name="description" content={String(data.page.meta.description)} />
        ) : null}
      </Helmet>

      <nav className="mb-8 text-sm">
        <Link to="/" className="text-white/50 hover:text-white/90 transition-colors">
          ← Accueil
        </Link>
      </nav>

      {loading ? (
        <p className="text-white/50">Chargement…</p>
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {error.message}
        </div>
      ) : (
        <>
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          </header>
          <Suspense fallback={<p className="text-white/50">Chargement du contenu…</p>}>
            <IriBlockRenderer blocks={blocks} />
          </Suspense>
        </>
      )}
    </div>
  );
}
