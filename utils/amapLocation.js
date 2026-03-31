/**
 * 高德地图 Web 服务：地点检索 + 地理编码
 * 与 Vue 端 MapSearch 定位策略保持一致（变体地址、候选打分、偏移校验）
 */

const AMAP_KEY = 'f912b11737cbc1bd7c50a495e2112315';

const DEFAULT_CENTER_LNG = 114.057868;
const DEFAULT_CENTER_LAT = 22.543099;

function getAddressDetailParts(room) {
  const detailKeys = [
    'roomNumber',
    'buildingNumber',
    'unitNumber',
    'doorNumber',
    'houseNo',
    'houseNumber',
    'addressDetail',
    'detailAddress'
  ];
  return detailKeys
    .map((key) => room[key])
    .filter(Boolean)
    .map((v) => String(v).trim());
}

function buildAddressVariants(room) {
  const variants = [];
  const addUnique = (value) => {
    const normalized = String(value || '').trim();
    if (normalized && !variants.includes(normalized)) {
      variants.push(normalized);
    }
  };

  const city = room.city || '';
  const district = room.district || '';
  const street = room.street || '';
  const communityName = room.communityName || '';
  const detailParts = getAddressDetailParts(room);
  const detailText = detailParts.join('');

  addUnique([city, district, street, communityName, detailText].filter(Boolean).join(''));
  addUnique([city, district, communityName, detailText].filter(Boolean).join(''));
  addUnique([district, street, communityName, detailText].filter(Boolean).join(''));
  addUnique([communityName, detailText].filter(Boolean).join(''));

  addUnique([city, district, street, communityName].filter(Boolean).join(''));
  addUnique([city, district, communityName].filter(Boolean).join(''));
  addUnique([district, communityName].filter(Boolean).join(''));
  addUnique(communityName);

  addUnique([city, district].filter(Boolean).join(''));
  addUnique(city);

  return variants;
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）\-_,，.。\/\\]/g, '');
}

function getCoreKeywords(room) {
  const detailParts = getAddressDetailParts(room);
  const raw = [room.communityName, room.district, room.street, ...detailParts].filter(Boolean);
  const unique = [];
  raw.forEach((item) => {
    const value = normalizeText(item);
    if (value && !unique.includes(value)) {
      unique.push(value);
    }
  });
  return unique;
}

function calculateDistanceMeters(lng1, lat1, lng2, lat2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function scoreLocationCandidate(room, candidateText, lng, lat) {
  const keywords = getCoreKeywords(room);
  const text = normalizeText(candidateText);
  let score = 0;

  keywords.forEach((kw) => {
    if (kw && text.includes(kw)) {
      score += kw.length >= 6 ? 3 : 2;
    }
  });

  const district = normalizeText(room.district);
  if (district && text.includes(district)) {
    score += 2;
  }

  const hasCurrentValid =
    room.longitude &&
    room.latitude &&
    !isNaN(parseFloat(room.longitude)) &&
    !isNaN(parseFloat(room.latitude));

  if (hasCurrentValid) {
    const oldLng = parseFloat(room.longitude);
    const oldLat = parseFloat(room.latitude);
    const distance = calculateDistanceMeters(oldLng, oldLat, lng, lat);
    if (distance <= 800) score += 3;
    else if (distance <= 2000) score += 2;
    else if (distance <= 5000) score += 1;
  }

  return score;
}

function validateCoordinateResult(room, result) {
  if (!result) return { ok: false, reason: '无定位结果' };
  if (isNaN(result.lng) || isNaN(result.lat)) return { ok: false, reason: '坐标格式无效' };

  const hasCurrentValid =
    room.longitude &&
    room.latitude &&
    !isNaN(parseFloat(room.longitude)) &&
    !isNaN(parseFloat(room.latitude));

  const currentLng = parseFloat(room.longitude);
  const currentLat = parseFloat(room.latitude);
  const isDefaultShenzhen =
    Math.abs(currentLng - DEFAULT_CENTER_LNG) < 0.01 && Math.abs(currentLat - DEFAULT_CENTER_LAT) < 0.01;

  if (hasCurrentValid && !isDefaultShenzhen) {
    const distance = calculateDistanceMeters(currentLng, currentLat, result.lng, result.lat);
    if (distance > 30000) {
      return { ok: false, reason: `新旧坐标偏移过大（${Math.round(distance)} 米）` };
    }
  }

  return { ok: true, reason: '' };
}

function parseLocationString(loc) {
  if (!loc || typeof loc !== 'string') return null;
  const parts = loc.split(',');
  if (parts.length < 2) return null;
  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  if (isNaN(lng) || isNaN(lat)) return null;
  return { lng, lat };
}

function amapGet(url, data) {
  const query = { key: AMAP_KEY, ...data };
  Object.keys(query).forEach((k) => {
    if (query[k] === undefined || query[k] === '') {
      delete query[k];
    }
  });
  return new Promise((resolve) => {
    wx.request({
      url,
      method: 'GET',
      data: query,
      success: (res) => {
        if (res.data && res.data.status === '1') {
          resolve(res.data);
        } else {
          resolve(null);
        }
      },
      fail: () => resolve(null)
    });
  });
}

function pickBestGeocode(room, geocodes) {
  if (!geocodes || geocodes.length === 0) return null;

  let best = null;
  let bestScore = -1;
  geocodes.slice(0, 5).forEach((item) => {
    if (!item || !item.location) return;
    const pos = parseLocationString(item.location);
    if (!pos) return;
    const candidateText = `${item.formatted_address || ''}${item.district || ''}${item.city || ''}${item.level || ''}`;
    const score = scoreLocationCandidate(room, candidateText, pos.lng, pos.lat);
    if (score > bestScore) {
      best = { item, pos };
      bestScore = score;
    }
  });

  return best;
}

async function tryPlaceSearchRest(room, addressVariants) {
  const city = (room.city || '').trim();

  for (let i = 0; i < addressVariants.length; i++) {
    const keyword = addressVariants[i];
    const placeParams = {
      keywords: keyword,
      offset: 25,
      page: 1,
      extensions: 'base',
      citylimit: city ? 'true' : 'false'
    };
    if (city) {
      placeParams.city = city;
    }
    const data = await amapGet('https://restapi.amap.com/v3/place/text', placeParams);

    const pois = (data && data.pois) || [];
    if (pois.length === 0) continue;

    let bestPoi = null;
    let bestScore = -1;

    pois.forEach((poi) => {
      const pos = parseLocationString(poi.location);
      if (!pos) return;
      const candidateText = `${poi.name || ''}${poi.address || ''}${poi.adname || ''}${poi.cityname || ''}`;
      const score = scoreLocationCandidate(room, candidateText, pos.lng, pos.lat);
      if (score > bestScore) {
        bestScore = score;
        bestPoi = { poi, pos };
      }
    });

    if (bestPoi && bestPoi.pos) {
      return {
        lng: bestPoi.pos.lng,
        lat: bestPoi.pos.lat,
        matchedAddress: keyword,
        attemptCount: i + 1,
        source: 'place-search',
        poiName: bestPoi.poi.name || ''
      };
    }
  }

  return null;
}

async function tryGeocodeRest(room, addressVariants) {
  const cityHint = room.city || '';

  for (let i = 0; i < addressVariants.length; i++) {
    const address = addressVariants[i];
    const data = await amapGet('https://restapi.amap.com/v3/geocode/geo', {
      address,
      city: cityHint || undefined
    });

    const geocodes = (data && data.geocodes) || [];
    const picked = pickBestGeocode(room, geocodes);
    if (picked && picked.pos) {
      return {
        lng: picked.pos.lng,
        lat: picked.pos.lat,
        matchedAddress: address,
        attemptCount: i + 1,
        source: 'geocoder',
        poiName: ''
      };
    }
  }

  return null;
}

/**
 * 返回 { result, addressVariants, reason }
 */
async function locateAndValidateCoordinate(room) {
  const addressVariants = buildAddressVariants(room);
  if (addressVariants.length === 0) {
    return { result: null, addressVariants, reason: '地址信息不足' };
  }

  const placeSlice = addressVariants.slice(0, 6);
  const placeResult = await tryPlaceSearchRest(room, placeSlice);
  if (placeResult) {
    const check = validateCoordinateResult(room, placeResult);
    if (check.ok) {
      return { result: placeResult, addressVariants, reason: '' };
    }
  }

  const geocodeResult = await tryGeocodeRest(room, addressVariants);
  const check = validateCoordinateResult(room, geocodeResult);
  return {
    result: check.ok ? geocodeResult : null,
    addressVariants,
    reason: check.ok ? '' : check.reason
  };
}

function roomNeedsCoordinateRefresh(room) {
  const hasAddressInfo = room.city || room.district || room.street || room.communityName;
  if (!hasAddressInfo) return false;

  const hasValidCoords =
    room.longitude &&
    room.latitude &&
    !isNaN(parseFloat(room.longitude)) &&
    !isNaN(parseFloat(room.latitude));

  if (!hasValidCoords) return true;

  const lng = parseFloat(room.longitude);
  const lat = parseFloat(room.latitude);
  const isDefaultShenzhen =
    Math.abs(lng - DEFAULT_CENTER_LNG) < 0.01 && Math.abs(lat - DEFAULT_CENTER_LAT) < 0.01;

  return isDefaultShenzhen;
}

/**
 * 周边 POI（与 Vue 端类型一致）
 */
async function fetchNearbyPoiItems(lng, lat) {
  const queries = [
    { type: 'subway', keyword: '地铁站', color: '#3B82F6' },
    { type: 'bus', keyword: '公交站', color: '#10B981' },
    { type: 'hospital', keyword: '医院', color: '#EF4444' },
    { type: 'supermarket', keyword: '超市', color: '#F59E0B' }
  ];

  const location = `${lng},${lat}`;

  const tasks = queries.map((q) =>
    amapGet('https://restapi.amap.com/v3/place/around', {
      location,
      keywords: q.keyword,
      radius: 1000,
      offset: 1,
      page: 1,
      extensions: 'base'
    }).then((data) => {
      const pois = (data && data.pois) || [];
      if (pois.length === 0) return null;
      const poi = pois[0];
      const dist = poi.distance != null ? parseInt(poi.distance, 10) : 0;
      return {
        type: q.type,
        name: poi.name || q.keyword,
        distance: dist || 0,
        color: q.color
      };
    })
  );

  const results = await Promise.all(tasks);
  return results.filter(Boolean).sort((a, b) => a.distance - b.distance);
}

module.exports = {
  AMAP_KEY,
  DEFAULT_CENTER_LNG,
  DEFAULT_CENTER_LAT,
  buildAddressVariants,
  locateAndValidateCoordinate,
  roomNeedsCoordinateRefresh,
  fetchNearbyPoiItems,
  calculateDistanceMeters
};
