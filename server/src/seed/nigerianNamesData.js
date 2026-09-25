// Generic, widely common Nigerian given names and surnames spanning Yoruba,
// Igbo, Hausa and other Nigerian naming traditions, used only as placeholder
// display names for historical matric-only records that carry no real name
// in their source documents (see oauHistoricalResultsData.js). These do not
// represent, and are not drawn from, any specific real individual's records.
export const NIGERIAN_FIRST_NAMES = [
  // Yoruba
  'Adebayo', 'Oluwaseun', 'Babajide', 'Adekunle', 'Oluwafemi', 'Babatunde', 'Adewale', 'Olumide', 'Ayodele', 'Oluwadamilare',
  'Folasade', 'Adunni', 'Yetunde', 'Bukola', 'Temitope', 'Omolara', 'Adenike', 'Folakemi', 'Oluwakemi', 'Abisola',
  // Igbo
  'Chukwuemeka', 'Chidi', 'Emeka', 'Obinna', 'Ikechukwu', 'Nnamdi', 'Chukwudi', 'Uchenna', 'Chinedu', 'Kelechi',
  'Ngozi', 'Chiamaka', 'Adaeze', 'Chidinma', 'Ifeoma', 'Ogechi', 'Nkechi', 'Amaka', 'Chinyere', 'Uzoamaka',
  // Hausa
  'Ibrahim', 'Abubakar', 'Yusuf', 'Aliyu', 'Musa', 'Suleiman', 'Garba', 'Nuhu', 'Sani', 'Bello',
  'Aisha', 'Fatima', 'Zainab', 'Hauwa', 'Amina', 'Maryam', 'Halima', 'Rabi', 'Saudatu', 'Khadija',
  // Common English/Christian names widely used in Nigeria
  'Emmanuel', 'Samuel', 'Joseph', 'Daniel', 'Peter', 'David', 'Grace', 'Blessing', 'Faith', 'Precious',
];

export const NIGERIAN_SURNAMES = [
  // Yoruba
  'Adeyemi', 'Ogunleye', 'Afolabi', 'Bakare', 'Adebisi', 'Fashola', 'Ogunbiyi', 'Owolabi', 'Adegoke', 'Oyelaran',
  'Ajayi', 'Olawale', 'Okunlola', 'Fagbohun', 'Adeleke', 'Oyewole', 'Balogun', 'Adeniran', 'Ogundipe', 'Oladapo',
  // Igbo
  'Okafor', 'Nwosu', 'Eze', 'Okoro', 'Nnadi', 'Okonkwo', 'Chukwu', 'Anyanwu', 'Obi', 'Ibe',
  'Nwachukwu', 'Ezeani', 'Onyekwere', 'Madueke', 'Uzoma', 'Okeke', 'Nnaji', 'Okoye', 'Ohaeri', 'Umeh',
  // Hausa
  'Abdullahi', 'Mohammed', 'Usman', 'Danjuma', 'Yakubu', 'Adamu', 'Lawal', 'Shehu', 'Idris', 'Tanko',
  'Mamman', 'Gambo', 'Abba', 'Balarabe', 'Muhammadu',
  // Other Nigerian (Efik/Ibibio, Edo, Tiv, etc.)
  'Effiong', 'Bassey', 'Etim', 'Akpan', 'Ekong', 'Uduak', 'Igiebor', 'Omoregie', 'Iornumbe', 'Terhemba',
];

function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically picks a firstName/otherNames/lastName combination for a
 * given key (e.g. a matric number), so re-running a seed produces the same
 * placeholder names instead of reshuffling them on every run.
 */
export function nameForKey(key) {
  let seed = 0;
  for (const ch of String(key)) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const random = mulberry32(seed);
  const firstIndex = Math.floor(random() * NIGERIAN_FIRST_NAMES.length);
  let otherIndex = Math.floor(random() * NIGERIAN_FIRST_NAMES.length);
  if (otherIndex === firstIndex) otherIndex = (otherIndex + 1) % NIGERIAN_FIRST_NAMES.length;
  const lastIndex = Math.floor(random() * NIGERIAN_SURNAMES.length);
  return {
    firstName: NIGERIAN_FIRST_NAMES[firstIndex],
    otherNames: NIGERIAN_FIRST_NAMES[otherIndex],
    lastName: NIGERIAN_SURNAMES[lastIndex],
  };
}
