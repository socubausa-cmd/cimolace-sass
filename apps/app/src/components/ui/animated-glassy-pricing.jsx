import React, { useRef, useEffect, useState } from 'react';
import { RippleButton } from '@/components/ui/multi-type-ripple-buttons';

/* ── CheckIcon ── */
const CheckIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/* ── WebGL Shader — scoped to section (position absolute) ── */
const ShaderCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vertSrc = `attribute vec2 aPosition; void main(){ gl_Position=vec4(aPosition,0.,1.); }`;
    const fragSrc = `
      precision highp float;
      uniform float iTime;
      uniform vec2 iResolution;
      mat2 rotate2d(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
      float variation(vec2 v1,vec2 v2,float str,float spd){ return sin(dot(normalize(v1),normalize(v2))*str+iTime*spd)/100.; }
      vec3 paintCircle(vec2 uv,vec2 center,float rad,float width){
        vec2 diff=center-uv; float len=length(diff);
        len+=variation(diff,vec2(0.,1.),5.,2.);
        len-=variation(diff,vec2(1.,0.),5.,2.);
        float circle=smoothstep(rad-width,rad,len)-smoothstep(rad,rad+width,len);
        return vec3(circle);
      }
      void main(){
        vec2 uv=gl_FragCoord.xy/iResolution.xy;
        uv.x*=1.5; uv.x-=0.25;
        float mask=0.;
        float radius=.35;
        vec2 center=vec2(.5);
        mask+=paintCircle(uv,center,radius,.035).r;
        mask+=paintCircle(uv,center,radius-.018,.01).r;
        mask+=paintCircle(uv,center,radius+.018,.005).r;
        vec2 v=rotate2d(iTime)*uv;
        /* CIMOLACE palette: violet → cyan */
        vec3 fg=vec3(0.80+v.x*0.15, 0.64+v.y*0.15, 0.34-v.y*v.x*0.15);
        vec3 bg=vec3(0.051,0.043,0.035); /* #0d0b09 — fond chaud du thème */
        vec3 color=mix(bg,fg,mask);
        color=mix(color,vec3(1.),paintCircle(uv,center,radius,.003).r);
        gl_FragColor=vec4(color,1.);
      }`;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const iTimeLoc = gl.getUniformLocation(prog, 'iTime');
    const iResLoc  = gl.getUniformLocation(prog, 'iResolution');

    let raf;
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const render = (t) => {
      gl.uniform1f(iTimeLoc, t * 0.001);
      gl.uniform2f(iResLoc, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block"
      style={{ opacity: 0.35 }}
    />
  );
};

/* ── PricingCard ── */
export const PricingCard = ({
  planName,
  description,
  price,
  priceSuffix = '/mois',
  currency = '€',
  features,
  buttonText,
  isPopular = false,
  buttonVariant = 'primary',
  accentColor,
  onCtaClick,
}) => {
  const cardBase = [
    'backdrop-blur-[14px] rounded-2xl shadow-xl flex-1 px-7 py-8 flex flex-col transition-all duration-300',
    'bg-gradient-to-br from-white/[0.06] to-white/[0.02] border',
    isPopular
      ? 'border-[#bf9a4f]/50 ring-2 ring-[#bf9a4f]/25 md:scale-105 relative shadow-2xl shadow-[#bf9a4f]/10'
      : 'border-white/[0.08] hover:border-white/20',
  ].join(' ');

  const btnBase = [
    'mt-auto w-full py-2.5 rounded-xl font-semibold text-sm transition-all',
    buttonVariant === 'primary'
      ? 'bg-[#bf9a4f] text-[#0d0b09] hover:brightness-110 shadow-lg shadow-black/30'
      : 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
  ].join(' ');

  return (
    <div className={cardBase}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-semibold rounded-full bg-[#bf9a4f] text-[#0d0b09] shadow-lg whitespace-nowrap">
          Plus populaire
        </div>
      )}

      {/* Plan name */}
      <div className="mb-3">
        <h2 className="text-4xl font-extralight tracking-tight text-white">{planName}</h2>
        <p className="text-sm text-white/60 mt-1">{description}</p>
      </div>

      {/* Price */}
      <div className="my-5 flex items-baseline gap-1">
        {price === 'Sur mesure' ? (
          <span className="text-3xl font-extralight text-white">{price}</span>
        ) : (
          <>
            <span className="text-5xl font-extralight text-white">{price}{currency}</span>
            <span className="text-sm text-white/50">{priceSuffix}</span>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="w-full mb-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Features */}
      <ul className="flex flex-col gap-2.5 text-sm text-white/80 mb-6 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <CheckIcon className="text-[#bf9a4f] w-4 h-4 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <RippleButton
        className={btnBase}
        rippleColor="rgba(191,154,79,0.35)"
        onClick={onCtaClick}
      >
        {buttonText}
      </RippleButton>
    </div>
  );
};

/* ── ModernPricingPage ── */
export const ModernPricingPage = ({
  title,
  subtitle,
  plans,
  showAnimatedBackground = true,
}) => (
  <div className="relative w-full overflow-hidden bg-[#0d0b09] text-white">
    {showAnimatedBackground && <ShaderCanvas />}
    <div className="relative z-10 w-full flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl mx-auto text-center mb-14">
        <h1 className="text-5xl md:text-6xl font-extralight leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-[#e7cd8f] to-[#bf9a4f]">
          {title}
        </h1>
        <p className="mt-4 text-lg md:text-xl text-white/70 max-w-2xl mx-auto">
          {subtitle}
        </p>
      </div>
      <div className="flex flex-col md:flex-row gap-8 md:gap-6 justify-center items-stretch w-full max-w-5xl">
        {plans.map((plan) => (
          <PricingCard key={plan.planName} {...plan} />
        ))}
      </div>
    </div>
  </div>
);
