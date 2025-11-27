// Password Generator - Format: WordWordWord123!
// Three random capitalized words + digit + symbol

const words = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
  'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
  'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
  'Yankee', 'Zulu', 'Apple', 'Banana', 'Cherry', 'Dragon', 'Eagle', 'Falcon',
  'Galaxy', 'Hammer', 'Island', 'Jungle', 'Knight', 'Lemon', 'Mango', 'Ninja',
  'Ocean', 'Panda', 'Queen', 'Rocket', 'Storm', 'Tiger', 'Ultra', 'Viper',
  'Wizard', 'Xenon', 'Yellow', 'Zebra', 'Anchor', 'Bridge', 'Castle', 'Diamond',
  'Empire', 'Forest', 'Golden', 'Harbor', 'Ivory', 'Jasper', 'Karma', 'Lunar',
  'Marble', 'Noble', 'Onyx', 'Phoenix', 'Quartz', 'Ruby', 'Silver', 'Thunder',
  'Umbra', 'Velvet', 'Winter', 'Crystal', 'Blaze', 'Cosmic', 'Drift', 'Ember',
  'Frost', 'Glider', 'Haze', 'Iron', 'Jade', 'Kite', 'Lance', 'Metro',
  'Nexus', 'Orbit', 'Pulse', 'Quest', 'Raven', 'Spark', 'Titan', 'Unity',
  'Volt', 'Wave', 'Apex', 'Bolt', 'Cipher', 'Dawn', 'Edge', 'Flame',
  'Grid', 'Hawk', 'Icon', 'Jet', 'Key', 'Link', 'Matrix', 'Nova',
  'Opal', 'Prime', 'Quad', 'Ridge', 'Scope', 'Trek', 'Ursa', 'Vortex'
];

const symbols = ['!', '@', '#', '$', '%', '&', '*'];

function generatePassword() {
  // Pick 3 random words
  const selectedWords = [];
  const usedIndices = new Set();
  
  while (selectedWords.length < 3) {
    const index = Math.floor(Math.random() * words.length);
    if (!usedIndices.has(index)) {
      usedIndices.add(index);
      selectedWords.push(words[index]);
    }
  }
  
  // Pick random digit (1-9)
  const digit = Math.floor(Math.random() * 9) + 1;
  
  // Pick random symbol
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  
  return `${selectedWords.join('')}${digit}${symbol}`;
}

module.exports = { generatePassword };
