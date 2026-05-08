import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center bg-black">
      <div className="max-w-md">
        <p className="text-8xl font-bold text-white/10 mb-4">404</p>
        <h1 className="text-2xl font-bold text-white mb-3">Page introuvable</h1>
        <p className="text-white/40 mb-10">La page que vous cherchez n&apos;existe pas ou a été déplacée.</p>
        <Link href="/" className="inline-flex items-center gap-2 bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-white/90 transition-all">Retour à l&apos;accueil</Link>
      </div>
    </div>
  );
}
