// Speed lines radiating from the centre, slowly turning, with a bright core.
fn shade(uv: vec2<f32>, res: vec2<f32>, time: f32) -> vec4<f32> {
  let aspect = res.x / max(res.y, 1.0);
  let p = (uv - vec2<f32>(0.5)) * vec2<f32>(aspect, 1.0);
  let ang = atan2(p.y, p.x) + time * 0.15;
  let rays = step(0.5, fract(ang * 24.0 / 6.2831853));
  let core = 1.0 - smoothstep(0.08, 0.32, length(p));
  let a = vec3<f32>(0.0, 0.682, 0.937);
  let b = vec3<f32>(1.0, 1.0, 1.0);
  let col = mix(mix(a, b, rays * 0.85), vec3<f32>(1.0, 0.93, 0.0), core);
  return vec4<f32>(col, 1.0);
}
