(() => {
  const canvas = document.getElementById('fluidCanvas');
  const heroSource = document.getElementById('heroSource');
  const cloneRed = document.getElementById('cloneRed');
  const cloneGreen = document.getElementById('cloneGreen');
  const cloneBlue = document.getElementById('cloneBlue');
  const cloneCore = document.getElementById('cloneCore');
  const glassLens = document.getElementById('glassLens');
  const lensInner = document.getElementById('lensInner');
  const hero = document.getElementById('home');
  const finePointer = matchMedia('(pointer:fine)').matches;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let pointerX = innerWidth * 0.36;
  let pointerY = innerHeight * 0.44;
  let lensX = pointerX;
  let lensY = pointerY;
  let scrollY = window.scrollY;
  let targetMix = 0.03;
  let currentMix = targetMix;
  let scrollSurge = 0;
  let frameId = 0;
  let previousFrame = 0;
  let startTime = performance.now();

  const lensLayers = [cloneRed, cloneGreen, cloneBlue, cloneCore];
  const lensCopies = [];

  const placeLensCopies = () => {
    if (!heroSource) return;
    const rect = heroSource.getBoundingClientRect();
    lensCopies.forEach((copy) => {
      copy.style.left = `${rect.left}px`;
      copy.style.top = `${rect.top}px`;
      copy.style.width = `${rect.width}px`;
    });
  };

  const updateLensSize = () => {
    const compact = hero && hero.getBoundingClientRect().bottom < innerHeight * 0.55;
    glassLens.classList.toggle('is-compact', compact);
  };

  if (finePointer && heroSource) {
    document.body.classList.add('has-pointer');

    lensLayers.forEach((layer) => {
      const copy = heroSource.cloneNode(true);
      copy.removeAttribute('id');
      copy.setAttribute('aria-hidden', 'true');
      copy.style.position = 'absolute';
      copy.style.margin = '0';
      copy.style.maxWidth = 'none';
      copy.style.pointerEvents = 'none';
      layer.append(copy);
      lensCopies.push(copy);
    });
    placeLensCopies();

    addEventListener('pointermove', (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
    }, { passive: true });
  }

  addEventListener('scroll', () => {
    placeLensCopies();
    updateLensSize();
  }, { passive: true });
  addEventListener('resize', () => {
    placeLensCopies();
    updateLensSize();
  }, { passive: true });
  updateLensSize();

  const fluidSections = [...document.querySelectorAll('main > section')];
  const sectionMixes = fluidSections.map((section) => {
    if (section.id === 'home') return 0.03;
    if (section.id === 'about') return 0.78;
    if (section.id === 'experience') return 0.88;
    if (section.id === 'work') return 1;
    if (section.classList.contains('skills')) return 0.82;
    if (section.id === 'contact') return 0.08;
    return 0.76;
  });
  let sectionCenters = [];

  const measureSections = () => {
    sectionCenters = fluidSections.map((section) => section.getBoundingClientRect().top + window.scrollY + section.offsetHeight / 2);
  };

  const mixAtScroll = () => {
    const focusY = window.scrollY + innerHeight * 0.5;
    if (sectionCenters.length < 2 || focusY <= sectionCenters[0]) return sectionMixes[0] ?? 0.03;
    for (let index = 0; index < sectionCenters.length - 1; index += 1) {
      if (focusY <= sectionCenters[index + 1]) {
        const span = Math.max(sectionCenters[index + 1] - sectionCenters[index], 1);
        const amount = Math.max(0, Math.min(1, (focusY - sectionCenters[index]) / span));
        const eased = amount * amount * (3 - 2 * amount);
        return sectionMixes[index] + (sectionMixes[index + 1] - sectionMixes[index]) * eased;
      }
    }
    return sectionMixes[sectionMixes.length - 1] ?? 0.08;
  };

  measureSections();
  targetMix = mixAtScroll();
  currentMix = targetMix;

  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' })
    || canvas.getContext('experimental-webgl');

  if (gl) {
    const vertexShaderSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_sectionMix;
      uniform float u_surge;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m *= m;
        m *= m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      float blob(vec2 uv, vec2 center, vec2 radii, float angle) {
        vec2 d = uv - center;
        float c = cos(angle), s = sin(angle);
        d = mat2(c, -s, s, c) * d;
        d /= radii;
        return exp(-dot(d, d) * 2.2);
      }

      void main() {
        vec2 uv = v_uv;
        float aspect = u_resolution.x / max(u_resolution.y, 1.0);
        vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
        vec2 m = vec2((u_mouse.x - 0.5) * aspect, u_mouse.y - 0.5);
        float t = u_time * 0.38;
        float mouseDist = length(p - m);
        vec2 mousePush = (p - m) * exp(-mouseDist * 4.5) * 0.08;
        vec2 warp = vec2(
          snoise(p * 1.35 + vec2(t * 0.45, -t * 0.3)),
          snoise(p * 1.35 + vec2(-t * 0.35, t * 0.5 + u_surge * 0.8))
        );
        vec2 warp2 = vec2(
          snoise(p * 2.1 + warp * 0.65 + vec2(-t * 0.25, t * 0.4)),
          snoise(p * 2.1 + warp * 0.65 + vec2(t * 0.3, -t * 0.25))
        );
        vec2 fluidUV = uv + warp * 0.14 + warp2 * 0.08 + mousePush;
        fluidUV.y += u_surge * 0.12 * snoise(uv * 2.0 + t);

        vec3 heroBase = vec3(0.012, 0.018, 0.032);
        vec3 steelBlue = vec3(0.24, 0.44, 0.68);
        vec3 deepCerulean = vec3(0.14, 0.29, 0.50);
        vec3 paleIce = vec3(0.42, 0.60, 0.82);
        vec2 b1 = vec2(0.24 + 0.12 * sin(t * 0.9), 0.76 + 0.10 * cos(t * 0.7));
        vec2 b2 = vec2(0.80 - 0.14 * cos(t * 0.6), 0.68 + 0.14 * sin(t * 0.8));
        vec2 b3 = vec2(0.74 + 0.12 * sin(t * 0.75), 0.20 + 0.10 * cos(t * 0.65));
        vec2 voidCenter = vec2(0.48 + 0.22 * sin(t * 0.85), 0.48 + 0.18 * cos(t * 0.65));
        float w1 = blob(fluidUV, b1, vec2(0.45, 0.38), t * 0.3);
        float w2 = blob(fluidUV, b2, vec2(0.48, 0.44), -t * 0.25);
        float w3 = blob(fluidUV, b3, vec2(0.52, 0.38), t * 0.2);
        float wVoid = blob(fluidUV, voidCenter, vec2(0.38, 0.42), -t * 0.4);
        vec3 heroColor = mix(heroBase, deepCerulean, clamp(w1 + w3, 0.0, 1.0));
        heroColor = mix(heroColor, steelBlue, clamp(w2 * 1.15, 0.0, 1.0));
        heroColor += paleIce * pow(clamp(w2 * w3 * 2.2, 0.0, 1.0), 1.5) * 0.35;
        heroColor = mix(heroColor, vec3(0.01, 0.012, 0.02), clamp(wVoid * 1.25, 0.0, 0.94));

        vec3 aboutColor = vec3(0.015, 0.02, 0.03);
        vec3 goldAmber = vec3(0.86, 0.62, 0.11);
        vec3 warmMustard = vec3(0.80, 0.66, 0.14);
        vec3 deepMagenta = vec3(0.58, 0.08, 0.44);
        vec3 richViolet = vec3(0.38, 0.06, 0.36);
        vec3 emeraldMint = vec3(0.14, 0.78, 0.54);
        vec2 g1 = vec2(0.12 + 0.07 * sin(t * 1.1), 0.64 + 0.08 * cos(t * 0.9));
        vec2 g2 = vec2(0.14 + 0.08 * cos(t * 0.85), 0.18 + 0.07 * sin(t));
        vec2 magenta = vec2(0.38 + 0.09 * sin(t * 0.8), 0.48 + 0.11 * cos(t * 0.75));
        vec2 green1 = vec2(0.62 + 0.10 * cos(t * 0.95), 0.84 + 0.07 * sin(t * 0.8));
        vec2 green2 = vec2(0.88 + 0.06 * sin(t * 0.7), 0.88 + 0.06 * cos(t * 0.9));
        vec2 darkZone = vec2(0.76 + 0.05 * cos(t * 0.6), 0.32 + 0.06 * sin(t * 0.6));
        float wg1 = blob(fluidUV, g1, vec2(0.30, 0.36), t * 0.25);
        float wg2 = blob(fluidUV, g2, vec2(0.32, 0.34), -t * 0.2);
        float wm = blob(fluidUV, magenta, vec2(0.36, 0.46), t * 0.35);
        float we1 = blob(fluidUV, green1, vec2(0.38, 0.30), -t * 0.3);
        float we2 = blob(fluidUV, green2, vec2(0.32, 0.28), t * 0.2);
        float wd = blob(fluidUV, darkZone, vec2(0.46, 0.42), 0.0);
        aboutColor = mix(aboutColor, richViolet, clamp(wm * 1.3, 0.0, 1.0));
        aboutColor = mix(aboutColor, deepMagenta, clamp(wm * 0.95, 0.0, 1.0));
        aboutColor = mix(aboutColor, goldAmber, clamp(wg1 * 1.15, 0.0, 1.0));
        aboutColor = mix(aboutColor, warmMustard, clamp(wg2 * 1.1, 0.0, 1.0));
        aboutColor = mix(aboutColor, emeraldMint, clamp(we1 + we2 * 0.85, 0.0, 1.0));
        aboutColor = mix(aboutColor, vec3(0.012, 0.016, 0.024), clamp(wd * 1.15, 0.0, 0.92));

        vec3 finalColor = mix(heroColor, aboutColor, smoothstep(0.0, 1.0, u_sectionMix));
        float dither = fract(sin(dot(gl_FragCoord.xy + u_time, vec2(12.9898, 78.233))) * 43758.5453);
        finalColor += (dither - 0.5) * 0.012;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Fluid background shader failed to compile:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (vertexShader && fragmentShader) {
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        const uniforms = {
          time: gl.getUniformLocation(program, 'u_time'),
          resolution: gl.getUniformLocation(program, 'u_resolution'),
          mouse: gl.getUniformLocation(program, 'u_mouse'),
          sectionMix: gl.getUniformLocation(program, 'u_sectionMix'),
          surge: gl.getUniformLocation(program, 'u_surge')
        };

        const resizeCanvas = () => {
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
          canvas.width = Math.round(innerWidth * pixelRatio);
          canvas.height = Math.round(innerHeight * pixelRatio);
          gl.viewport(0, 0, canvas.width, canvas.height);
          measureSections();
          targetMix = mixAtScroll();
          drawFrame(performance.now(), true);
        };

        const drawFrame = (timestamp, force = false) => {
          frameId = 0;
          if (document.hidden) return;
          if (!reducedMotion && !force && timestamp - previousFrame < 1000 / 30) {
            frameId = requestAnimationFrame((next) => drawFrame(next));
            return;
          }
          previousFrame = timestamp;
          currentMix = reducedMotion ? targetMix : currentMix + (targetMix - currentMix) * 0.045;
          scrollSurge = reducedMotion ? 0 : scrollSurge * 0.92;
          gl.uniform1f(uniforms.time, reducedMotion ? 0 : (timestamp - startTime) * 0.001);
          gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
          gl.uniform2f(uniforms.mouse, pointerX / Math.max(innerWidth, 1), 1 - pointerY / Math.max(innerHeight, 1));
          gl.uniform1f(uniforms.sectionMix, currentMix);
          gl.uniform1f(uniforms.surge, scrollSurge);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          if (!reducedMotion) frameId = requestAnimationFrame((next) => drawFrame(next));
        };

        const requestDraw = () => {
          if (!frameId) frameId = requestAnimationFrame((timestamp) => drawFrame(timestamp));
        };

        const handleScroll = () => {
          const nextScrollY = window.scrollY;
          scrollSurge = Math.min(1.35, Math.abs(nextScrollY - scrollY) / 42);
          scrollY = nextScrollY;
          targetMix = mixAtScroll();
          placeLensCopies();
          if (reducedMotion) requestDraw();
        };

        addEventListener('resize', resizeCanvas, { passive: true });
        addEventListener('scroll', handleScroll, { passive: true });
        addEventListener('load', () => {
          measureSections();
          targetMix = mixAtScroll();
          placeLensCopies();
        }, { once: true });
        document.addEventListener('visibilitychange', () => {
          if (document.hidden && frameId) {
            cancelAnimationFrame(frameId);
            frameId = 0;
          } else if (!reducedMotion) requestDraw();
        });

        resizeCanvas();
        if (!reducedMotion) requestDraw();
      } else {
        console.warn('Fluid background shader failed to link:', gl.getProgramInfoLog(program));
      }
    }
  }

  if (finePointer) {
    const MAGNIFICATION = 1.18;
    const DAMPING = 0.14;
    const moveLens = () => {
      lensX += (pointerX - lensX) * DAMPING;
      lensY += (pointerY - lensY) * DAMPING;

      glassLens.style.left = `${lensX}px`;
      glassLens.style.top = `${lensY}px`;

      const lensRadius = glassLens.offsetWidth / 2;
      lensInner.style.transformOrigin = `${lensX}px ${lensY}px`;
      lensInner.style.transform = `translate(${lensRadius - lensX}px, ${lensRadius - lensY}px) scale(${MAGNIFICATION})`;
      requestAnimationFrame(moveLens);
    };
    moveLens();
  }
})();
