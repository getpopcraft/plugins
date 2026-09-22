// Ben-Day dots: a rotated dot screen whose dot size follows a slow diagonal gradient.
fn shade(uv: vec2<f32>, res: vec2<f32>, time: f32) -> vec4<f32> {
  let paper = vec3<f32>(1.0, 0.93, 0.0);
  let ink = vec3<f32>(0.925, 0.0, 0.549);
  let a = 0.785398;
  let p = uv * res;
  let r = vec2<f32>(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
  let cell = 14.0;
  let f = fract(r / cell) - vec2<f32>(0.5);
  let tone = 0.5 + 0.5 * sin((uv.x + uv.y) * 3.0 + time * 0.6);
  let radius = mix(0.12, 0.48, tone);
  let d = length(f);
  let edge = 1.0 - smoothstep(radius - 0.04, radius + 0.04, d);
  return vec4<f32>(mix(paper, ink, edge), 1.0);
}
