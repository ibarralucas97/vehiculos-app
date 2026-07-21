function normalizeComparableKm(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return value;
  }

  return parsed;
}

function didMileageChange(previousKm, nextKm) {
  return normalizeComparableKm(previousKm) !== normalizeComparableKm(nextKm);
}

module.exports = {
  didMileageChange,
  normalizeComparableKm,
};
