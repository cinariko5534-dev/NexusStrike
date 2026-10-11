// Basit çarpışma sistemi: tüm katı objeler eksen hizalı kutu (AABB) olarak tutulur.
export const colliders = [];

export function removeCollider(box) {
  const i = colliders.indexOf(box);
  if (i >= 0) colliders.splice(i, 1);
}

// Ayak pozisyonu `pos` olan dik bir kutuyu (yarıçap, yükseklik) hareket ettirir.
// Her ekseni ayrı ayrı çözerek duvarlar boyunca kaymayı sağlar. Yerdeyse true döner.
export function moveBody(pos, vel, dt, radius, height, stepHeight = 0) {
  let onGround = false;
  for (const axis of ['x', 'z', 'y']) {
    const delta = vel[axis] * dt;
    if (delta === 0) continue;
    pos[axis] += delta;
    for (const c of colliders) {
      if (pos.x + radius <= c.min.x || pos.x - radius >= c.max.x) continue;
      if (pos.z + radius <= c.min.z || pos.z - radius >= c.max.z) continue;
      if (pos.y + height <= c.min.y || pos.y >= c.max.y) continue;
      if (axis === 'y') {
        if (delta < 0) { pos.y = c.max.y; onGround = true; } else { pos.y = c.min.y - height; }
        vel.y = 0;
      } else {
        // Alçak basamaklara otomatik çık
        const rise = c.max.y - pos.y;
        if (stepHeight > 0 && rise > 0 && rise <= stepHeight) { pos.y = c.max.y; continue; }
        pos[axis] = delta > 0 ? c.min[axis] - radius - 0.001 : c.max[axis] + radius + 0.001;
      }
    }
  }
  if (pos.y <= 0) {
    pos.y = 0;
    if (vel.y < 0) vel.y = 0;
    onGround = true;
  }
  return onGround;
}

// Verilen kutu bir objeyle çakışıyor mu? (eğilmeden kalkarken tavan kontrolü için)
export function overlaps(pos, radius, height) {
  for (const c of colliders) {
    if (pos.x + radius <= c.min.x || pos.x - radius >= c.max.x) continue;
    if (pos.z + radius <= c.min.z || pos.z - radius >= c.max.z) continue;
    if (pos.y + height <= c.min.y || pos.y + 0.05 >= c.max.y) continue;
    return true;
  }
  return false;
}

// Bir nokta herhangi bir kutunun içinde mi?
export function pointInside(p, pad = 0) {
  for (const c of colliders) {
    if (p.x > c.min.x - pad && p.x < c.max.x + pad &&
        p.y > c.min.y - pad && p.y < c.max.y + pad &&
        p.z > c.min.z - pad && p.z < c.max.z + pad) return c;
  }
  return null;
}
