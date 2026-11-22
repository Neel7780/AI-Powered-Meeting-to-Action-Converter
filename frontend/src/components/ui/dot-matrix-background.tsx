import { useEffect, useRef, useState } from "react";
import * as bundledThree from "three";

/**
 * Checks whether WebGL / WebGL2 context creation is actually supported
 * in the current browser environment without throwing unhandled exceptions.
 */
function isWebGLSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export function DotMatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglAvailable, setWebglAvailable] = useState<boolean>(() => isWebGLSupported());

  useEffect(() => {
    if (!webglAvailable) return;

    let active = true;
    let renderer: any = null;
    let geometry: any = null;
    let material: any = null;
    let scene: any = null;
    let camera: any = null;
    let animationId: number | null = null;

    const initThree = (THREE: any) => {
      if (!canvasRef.current || !active) return;
      const canvas = canvasRef.current;

      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: false,
          failIfMajorPerformanceCaveat: false,
          powerPreference: "default",
        });
      } catch (err) {
        console.warn("WebGL initialization failed, falling back to static background:", err);
        if (active) setWebglAvailable(false);
        return;
      }

      if (!renderer) {
        if (active) setWebglAvailable(false);
        return;
      }

      try {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);

        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const uniforms = {
          u_time: { value: 0 },
          u_resolution: { value: new THREE.Vector2(window.innerWidth * 2, window.innerHeight * 2) },
          u_opacities: { value: [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1.0] },
          u_colors: {
            value: [
              new THREE.Vector3(1, 1, 1),
              new THREE.Vector3(1, 1, 1),
              new THREE.Vector3(1, 1, 1),
              new THREE.Vector3(1, 1, 1),
              new THREE.Vector3(1, 1, 1),
              new THREE.Vector3(1, 1, 1),
            ],
          },
          u_total_size: { value: 20.0 },
          u_dot_size: { value: 6.0 },
          u_reverse: { value: 0 },
        };

        material = new THREE.ShaderMaterial({
          vertexShader: `
            precision mediump float;
            uniform vec2 u_resolution;
            out vec2 fragCoord;
            void main() {
              gl_Position = vec4(position, 1.0);
              fragCoord = (position.xy + 1.0) * 0.5 * u_resolution;
              fragCoord.y = u_resolution.y - fragCoord.y;
            }
          `,
          fragmentShader: `
            precision mediump float;
            in vec2 fragCoord;

            uniform float u_time;
            uniform float u_opacities[10];
            uniform vec3 u_colors[6];
            uniform float u_total_size;
            uniform float u_dot_size;
            uniform vec2 u_resolution;
            uniform int u_reverse;

            out vec4 fragColor;

            float PHI = 1.61803398874989484820459;
            float random(vec2 xy) {
                return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
            }

            void main() {
                vec2 st = fragCoord.xy;
                st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
                st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

                float opacity = step(0.0, st.x) * step(0.0, st.y);

                vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

                float frequency = 5.0;
                float show_offset = random(st2);
                float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
                opacity *= u_opacities[int(rand * 10.0)];
                opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
                opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

                vec3 color = u_colors[int(show_offset * 6.0)];

                float animation_speed_factor = 3.0;
                vec2 center_grid = u_resolution / 2.0 / u_total_size;
                float dist_from_center = distance(center_grid, st2);

                float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);

                float current_timing_offset = timing_offset_intro;
                opacity *= step(current_timing_offset, u_time * animation_speed_factor);
                opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);

                fragColor = vec4(color, opacity);
                fragColor.rgb *= fragColor.a;
            }
          `,
          uniforms: uniforms,
          glslVersion: THREE.GLSL3,
          blending: THREE.CustomBlending,
          blendSrc: THREE.SrcAlphaFactor,
          blendDst: THREE.OneFactor,
          transparent: true,
        });

        geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const startTime = performance.now();
        const animate = () => {
          if (!active) return;
          animationId = requestAnimationFrame(animate);
          uniforms.u_time.value = (performance.now() - startTime) / 1000.0;
          renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
          if (!active || !renderer) return;
          try {
            renderer.setSize(window.innerWidth, window.innerHeight);
            uniforms.u_resolution.value.set(window.innerWidth * 2, window.innerHeight * 2);
          } catch {
            // ignore resize issues
          }
        };
        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("resize", handleResize);
        };
      } catch (err) {
        console.warn("Three.js render pipeline error, falling back to static background:", err);
        if (active) setWebglAvailable(false);
      }
    };

    const effectiveThree = (window as any).THREE || bundledThree;
    let cleanUp: (() => void) | void;

    if (effectiveThree) {
      cleanUp = initThree(effectiveThree);
    } else {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.async = true;
      script.onload = () => {
        if (!active) return;
        if ((window as any).THREE) {
          cleanUp = initThree((window as any).THREE);
        }
      };
      script.onerror = () => {
        if (active) setWebglAvailable(false);
      };
      document.head.appendChild(script);
    }

    return () => {
      active = false;
      if (cleanUp) cleanUp();
      if (animationId) cancelAnimationFrame(animationId);
      if (renderer) {
        try {
          renderer.dispose();
        } catch {
          // ignore cleanup error
        }
      }
      if (geometry) {
        try {
          geometry.dispose();
        } catch {
          // ignore cleanup error
        }
      }
      if (material) {
        try {
          material.dispose();
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, [webglAvailable]);

  // If WebGL is not available, render the existing static background seamlessly
  if (!webglAvailable) {
    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {/* Existing ActionPulse hero-atmosphere backdrop */}
        <div className="hero-atmosphere absolute inset-0" />

        {/* Static dot grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.16,
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.7) 1.5px, transparent 1.5px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background: "radial-gradient(circle at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.92) 100%)",
          }}
        />
      </div>
    );
  }

  return (
    <>
      {/* WebGL Dot canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, zIndex: 0, width: "100%", height: "100%" }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "radial-gradient(circle at center,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0) 100%)",
          pointerEvents: "none",
        }}
      />
    </>
  );
}

export default DotMatrixBackground;
