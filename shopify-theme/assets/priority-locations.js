(function() {
  var SEED_SLUG_PATHS = [
    '/missing-people/united-kingdom/england/london',
    '/missing-people/united-states/new-york/new-york-city',
    '/missing-people/france/ile-de-france/paris',
    '/missing-people/india/maharashtra/mumbai'
  ];
  var CITY_TYPES = { city: true, town: true, municipality: true, mixed: true };

  function unique(entries) {
    var seen = {};
    return (entries || []).filter(function(entry) {
      if (!entry || !entry.id || seen[entry.id] || !entry.slugPath) return false;
      seen[entry.id] = true;
      return true;
    });
  }

  function score(entry) {
    var population = Number(entry.approximatePopulation || 0);
    var typeBoost = CITY_TYPES[entry.type] ? 500000 : (entry.type === 'country' ? 250000 : 0);
    var capitalBoost = /PPLC|PPLA/.test(String(entry.featureCode || '')) ? 250000 : 0;
    return population + typeBoost + capitalBoost;
  }

  function byPriority(a, b) {
    return score(b) - score(a) || String(a.name || '').localeCompare(String(b.name || ''));
  }

  function entriesFromSeeds(registry) {
    return SEED_SLUG_PATHS.map(function(path) {
      return (registry.entries || []).find(function(entry) {
        return entry.slugPath === path;
      });
    }).filter(Boolean);
  }

  function loadSeedCountries(registry) {
    if (!registry || typeof registry.loadCountry !== 'function') {
      return Promise.resolve(registry);
    }
    return Promise.all(['gb', 'us', 'fr', 'in'].map(function(countryCode) {
      return registry.loadCountry(countryCode).catch(function() {
        return [];
      });
    })).then(function() {
      return registry;
    });
  }

  function load(registry) {
    if (!registry) return Promise.resolve([]);
    return loadSeedCountries(registry).then(function() {
      var seeds = entriesFromSeeds(registry);
      var ranked = (registry.entries || []).filter(function(entry) {
        return entry && entry.slugPath && (CITY_TYPES[entry.type] || entry.type === 'country') && Number(entry.approximatePopulation || 0) >= 5000;
      }).sort(byPriority);
      return unique(seeds.concat(ranked)).slice(0, 1000);
    });
  }

  window.MissingAlertsPriorityLocations = {
    limit: 1000,
    seedSlugPaths: SEED_SLUG_PATHS.slice(),
    load: load
  };
})();
