import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const getShaderHtml = (isDarkMode) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width,initial-scale=1.0" name="viewport"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: ${isDarkMode ? '#101415' : '#FFFFFF'}; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function() {
  const canvas = document.getElementById('c');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  // Vertex shader - full-screen quad
  const vs = \`
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  \`;

  // Fragment shader - organic mesh gradient
  const fs = \`
    precision highp float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_res;

    // ---- Brand Colors ----
    ${isDarkMode ? `
    vec3 COL_NAVY  = vec3(0.063, 0.078, 0.082);   // Deep Navy   #101415
    vec3 COL_BLUE  = vec3(0.145, 0.388, 0.922);   // Royal Blue  #2563EB
    vec3 COL_CYAN  = vec3(0.220, 0.745, 0.973);   // Elec. Cyan  #38BDF8
    ` : `
    vec3 COL_NAVY  = vec3(0.933, 0.965, 1.000);   // Ice Blue    #EEF6FF  (light variant)
    vec3 COL_BLUE  = vec3(0.376, 0.639, 0.980);   // Soft Blue   #60A5FA  (light variant)
    vec3 COL_CYAN  = vec3(0.220, 0.745, 0.973);   // Elec. Cyan  #38BDF8
    `}

    // Smooth hash - no texture lookup needed
    float hash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }

    // Smooth value noise
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);   // smoothstep blend
      return mix(
        mix(hash(i),             hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    // Fractal Brownian Motion  (3 octaves - mobile friendly)
    float fbm(vec2 p) {
      float v = 0.0, amp = 0.5;
      for (int i = 0; i < 3; i++) {
        v   += amp * noise(p);
        p   *= 2.0;
        amp *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv  = v_uv;
      uv.x    *= u_res.x / u_res.y;    // correct aspect

      float t  = u_time * 0.12;        // slow breathing speed

      // --- Three organic "blobs" of color driven by fbm ---
      // Each blob is a slow-drifting noise field centre
      vec2 q = vec2(
        fbm(uv + vec2(0.00, 0.00) + t * 0.3),
        fbm(uv + vec2(1.73, 0.93) + t * 0.25)
      );

      vec2 r = vec2(
        fbm(uv + 4.0 * q + vec2(1.70, 9.20) - t * 0.18),
        fbm(uv + 4.0 * q + vec2(8.30, 2.80) + t * 0.22)
      );

      float f = fbm(uv + 4.5 * r + t * 0.15);

      // Map f (0-1) to a three-stop gradient:
      //  0.0  ->  COL_NAVY
      //  0.5  ->  COL_BLUE
      //  1.0  ->  COL_CYAN
      vec3 color;
      if (f < 0.5) {
        color = mix(COL_NAVY, COL_BLUE, f * 2.0);
      } else {
        color = mix(COL_BLUE, COL_CYAN, (f - 0.5) * 2.0);
      }

      // Soft vignette toward edges
      float vig = 1.0 - 0.4 * pow(length(v_uv - 0.5) * 1.6, 2.0);
      color *= vig;

      // Subtle film grain for premium texture
      float grain = (hash(v_uv + fract(u_time)) - 0.5) * 0.018;
      color = clamp(color + grain, 0.0, 1.0);

      gl_FragColor = vec4(color, 1.0);
    }
  \`;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // Full-screen triangle strip
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes  = gl.getUniformLocation(prog, 'u_res');

  function render(ts) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uTime, ts * 0.001);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
</script>
</body>
</html>
`;

const PremiumBackground = React.memo(function PremiumBackground() {
  const { isDarkMode } = useTheme();

  // Particle animations
  const particleCount = 30;
  const particles = useRef(
    [...Array(particleCount)].map(() => ({
      anim: new Animated.Value(0),
      size: 1.5 + Math.random() * 2.5,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 10000,
      duration: 15000 + Math.random() * 15000,
      drift: (Math.random() - 0.5) * 50,
    }))
  ).current;

  useEffect(() => {
    particles.forEach((p) => {
      const float = () => {
        p.anim.setValue(0);
        Animated.timing(p.anim, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          useNativeDriver: true,
        }).start(() => float());
      };
      float();
    });
  }, []);

  const gridSpacing = 48;
  const cols = Math.ceil(width / gridSpacing);
  const rows = Math.ceil(height / gridSpacing);

  const gridColor   = isDarkMode ? 'rgba(255,255,255,0.025)' : 'rgba(37,99,235,0.07)';
  const particleClr = isDarkMode ? '#38BDF8' : '#2563EB';
  const iconClr     = isDarkMode ? '#38BDF8' : '#2563EB';
  const iconOpacity = isDarkMode ? 0.03 : 0.04;

  return (
    <View pointerEvents="none" style={styles.container}>
      {/* WebGL Mesh Gradient */}
      <View style={StyleSheet.absoluteFill}>
        <WebView
          key={`bg-${isDarkMode ? 'dark' : 'light'}`}
          source={{ html: getShaderHtml(isDarkMode) }}
          style={StyleSheet.absoluteFill}
          scrollEnabled={false}
          overScrollMode="never"
          pointerEvents="none"
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          backgroundColor={isDarkMode ? '#101415' : '#FFFFFF'}
        />
      </View>

      {/* Blueprint Grid */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[...Array(cols)].map((_, i) => (
          <View key={`col-${i}`} style={{ position:'absolute', left: i * gridSpacing, top: 0, bottom: 0, width: 1, backgroundColor: gridColor }} />
        ))}
        {[...Array(rows)].map((_, i) => (
          <View key={`row-${i}`} style={{ position:'absolute', top: i * gridSpacing, left: 0, right: 0, height: 1, backgroundColor: gridColor }} />
        ))}
      </View>

      {/* Faint Service Icons */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Icon name="handyman" size={130} color={iconClr} style={{ position:'absolute', top:'12%', left:'8%',  opacity: iconOpacity, transform:[{rotate:'-12deg'}] }} />
        <Icon name="bolt"     size={170} color={iconClr} style={{ position:'absolute', bottom:'18%', right:'4%', opacity: iconOpacity, transform:[{rotate:'40deg'}]  }} />
        <Icon name="home"     size={150} color={iconClr} style={{ position:'absolute', top:'42%', right:'12%', opacity: iconOpacity, transform:[{rotate:'-5deg'}]  }} />
      </View>

      {/* Drifting Particles */}
      {particles.map((p, i) => {
        const tY = p.anim.interpolate({ inputRange:[0,1], outputRange:[height * 0.6, -160] });
        const tX = p.anim.interpolate({ inputRange:[0,1], outputRange:[0, p.drift] });
        const op = p.anim.interpolate({ inputRange:[0,0.1,0.85,1], outputRange:[0,0.3,0.3,0] });
        const sc = p.anim.interpolate({ inputRange:[0,0.5,1], outputRange:[0.3,1.0,0.3] });
        return (
          <Animated.View
            key={`p-${i}`}
            style={{
              position:'absolute',
              left: `${p.left}%`,
              top:  `${p.top}%`,
              width: p.size, height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: particleClr,
              opacity: op,
              transform: [{ translateY: tY }, { translateX: tX }, { scale: sc }],
            }}
          />
        );
      })}
    </View>
  );
});

export default PremiumBackground;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
