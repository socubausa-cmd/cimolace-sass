import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

export default function CimolaceBlogPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-16">
      <Helmet>
        <title>Blog | {cimolacePlatformConfig.productName}</title>
        <meta name="description" content="Blog CIMOLACE." />
      </Helmet>

      <div className="max-w-3xl mx-auto">
        <Link to={cimolacePlatformConfig.routes.home} className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
          ← Retour à l’accueil
        </Link>
        <h1 className="mt-6 text-3xl md:text-4xl font-black tracking-tight">Blog</h1>
        <p className="mt-4 text-white/70">
          Stub. Ajoutez vos articles / annonces produit.
        </p>
      </div>
    </div>
  );
}

