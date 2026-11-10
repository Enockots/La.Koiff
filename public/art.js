/* Illustrations des modèles sans photo */
window.art = function(m){
  const h = m.hair || "#1B1411", sk = m.skin, W = "rgba(255,255,255,.22)";
  const back = [], front = [];
  const cap = `<path d="M35 68 C32 38 48 29 60 29 C72 29 88 38 85 68 C80 50 71 45 60 45 C49 45 40 50 35 68 Z" fill="${h}"/>`;
  const shortCap = `<path d="M38 62 C37 40 49 35 60 35 C71 35 83 40 82 62 C78 51 70 48 60 48 C50 48 42 51 38 62 Z" fill="${h}"/>`;
  const sides = `<rect x="37" y="55" width="4" height="13" rx="2" fill="${h}" opacity=".45"/><rect x="79" y="55" width="4" height="13" rx="2" fill="${h}" opacity=".45"/>`;
  const strands = (n,x0,x1,y0,y1,w,wavy) => { let o=""; for(let i=0;i<n;i++){ const x=x0+(x1-x0)*i/(n-1);
      const d = wavy ? `M${x} ${y0} q4 6 0 12 q-4 6 0 12 q4 6 0 12 q-4 6 0 12 q4 6 0 12 q-4 6 0 12`
                     : `M${x} ${y0} L${(x+(x-60)*.15).toFixed(1)} ${(y1-Math.abs(x-60)*.35).toFixed(1)}`;
      o += `<path d="${d}" stroke="${h}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`; } return o; };
  const dome = `<ellipse cx="60" cy="58" rx="30" ry="28" fill="${h}"/>`;
  const longBack = `<path d="M30 62 C26 28 94 28 90 62 L98 136 C78 142 42 142 22 136 Z" fill="${h}"/>`;
  const sweep = `<path d="M35 70 C30 36 52 26 64 29 C80 32 90 46 85 72 C78 50 60 42 47 52 C41 57 38 63 35 70 Z" fill="${h}"/>`;
  const bun = `<circle cx="60" cy="25" r="13" fill="${h}"/>`;
  switch(m.art){
    case "braids":   back.push(dome, strands(13,30,90,60,140,4)); front.push(cap, `<path d="M60 30 V45" stroke="${W}" stroke-width="1.5"/>`); break;
    case "knotless": back.push(dome, strands(17,28,92,60,148,2.6)); front.push(cap);
                     for(let i=0;i<5;i++) front.push(`<circle cx="${34+i*13}" cy="${142-Math.abs(34+i*13-60)*.35}" r="2.2" fill="#E8B830"/>`); break;
    case "twists":   back.push(dome, strands(9,31,89,58,0,5.5,true)); front.push(cap); break;
    case "cornrows": back.push(strands(5,50,70,84,116,4)); front.push(cap);
                     for(let i=0;i<6;i++){ const x=38+i*8.8; front.push(`<path d="M${x} 64 Q${x+(60-x)*.15} 40 ${(55+i*2).toFixed(1)} 30" stroke="${W}" stroke-width="1.6" fill="none"/>`); } break;
    case "long":     back.push(longBack); front.push(sweep); break;
    case "curls":    back.push(longBack); for(let i=0;i<8;i++) back.push(`<circle cx="${24+i*10.3}" cy="${134-(i%2)*4}" r="7" fill="${h}"/>`); front.push(sweep); break;
    case "afro":     back.push(`<circle cx="60" cy="54" r="43" fill="${h}"/>`); front.push(shortCap); break;
    case "locks":    back.push(dome, strands(8,32,88,60,130,7)); front.push(cap); break;
    case "bun":      front.push(cap, bun); break;
    case "bridal":   front.push(cap, bun); [[50,20,"#FFFFFF"],[60,13,"#F4C6D3"],[70,20,"#FFFFFF"],[47,30,"#F4C6D3"],[73,30,"#F4C6D3"]].forEach(([x,y,c])=>front.push(`<circle cx="${x}" cy="${y}" r="3.6" fill="${c}"/>`));
                     front.push(`<circle cx="37" cy="80" r="2.4" fill="#E8B830"/><circle cx="83" cy="80" r="2.4" fill="#E8B830"/>`); break;
    case "fade":     front.push(shortCap, sides); break;
    case "waves":    front.push(shortCap, sides); for(let i=0;i<3;i++) front.push(`<path d="M44 ${40+i*3.5} q4 -2.5 8 0 q4 2.5 8 0 q4 -2.5 8 0 q4 2.5 8 0" stroke="${W}" stroke-width="1.3" fill="none"/>`); break;
    case "hightop":  front.push(`<path d="M38 62 L38 22 Q38 15 45 15 L75 15 Q82 15 82 22 L82 62 C78 51 70 48 60 48 C50 48 42 51 38 62 Z" fill="${h}"/>`, sides); break;
    case "beard":    front.push(shortCap, sides, `<path d="M38 70 C38 101 50 101 60 101 C70 101 82 101 82 70 C80 85 72 90 60 90 C48 90 40 85 38 70 Z" fill="${h}"/>`); break;
    case "bald":     front.push(`<ellipse cx="51" cy="51" rx="8" ry="4.5" fill="#FFFFFF" opacity=".2" transform="rotate(-25 51 51)"/>`, `<path d="M40 76 C41 100 51 99 60 99 C69 99 79 100 80 76 C77 88 70 91 60 91 C50 91 43 88 40 76 Z" fill="${h}" opacity=".9"/>`); break;
  }
  const k = m.kid ? ` transform="translate(60 150) scale(.86) translate(-60 -150)"` : "";
  return `<svg viewBox="0 0 120 150" role="img" aria-label="Illustration : ${m.name}"><rect width="120" height="150" fill="${m.bg}"/>
    <g${k}><path d="M8 152 C12 120 34 110 60 110 C86 110 108 120 112 152 Z" fill="${m.shirt}"/>${back.join("")}
    <rect x="51" y="86" width="18" height="28" rx="6" fill="${sk}"/><ellipse cx="37" cy="72" rx="4" ry="6" fill="${sk}"/><ellipse cx="83" cy="72" rx="4" ry="6" fill="${sk}"/>
    <ellipse cx="60" cy="70" rx="22" ry="27" fill="${sk}"/>${front.join("")}</g></svg>`;
}

