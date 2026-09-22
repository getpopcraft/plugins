// Three offset ink plates, multiplied like a cheap press run where the plates drift out of register.
fn blob(uv: vec2<f32>, c: vec2<f32>) -> f32 {
  return 1.0 - smoothstep(0.18, 0.2, length(uv - c));
}

fn shade(uv: vec2<f32>, res: vec2<f32>, time: f32) -> vec4<f32> {
  let wobble = vec2<f32>(sin(time * 0.9), cos(time * 0.7)) * 0.015;
  let c = blob(uv, vec2<f32>(0.46, 0.5) + wobble);
  let m = blob(uv, vec2<f32>(0.54, 0.47) - wobble);
  let y = blob(uv, vec2<f32>(0.5, 0.56) + wobble.yx);
  var col = vec3<f32>(1.0, 0.99, 0.95);
  col = col * mix(vec3<f32>(1.0), vec3<f32>(0.0, 0.68, 0.94), c);
  col = col * mix(vec3<f32>(1.0), vec3<f32>(0.93, 0.0, 0.55), m);
  col = col * mix(vec3<f32>(1.0), vec3<f32>(1.0, 0.93, 0.0), y);
  return vec4<f32>(col, 1.0);
}
