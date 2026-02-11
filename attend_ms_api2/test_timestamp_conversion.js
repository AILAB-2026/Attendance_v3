// Test the exact timestamp from API response
const timestamp = 1762920834000;

console.log('🧪 Testing Timestamp Conversion');
console.log('===============================');
console.log('Timestamp:', timestamp);
console.log('Is > 1e12?', timestamp > 1e12);
console.log('1e12 value:', 1e12);

// Convert to Date
const date = new Date(timestamp);
console.log('Date object:', date);
console.log('UTC string:', date.toUTCString());
console.log('Local string:', date.toString());
console.log('Local time (toLocaleTimeString):', date.toLocaleTimeString());

// Test the mobile app logic
const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
const d = new Date(ms);
console.log('\nMobile app logic:');
console.log('ms value:', ms);
console.log('Date from ms:', d);
console.log('Local time from mobile logic:', d.toLocaleTimeString());

// Manual verification - what should 12:13:54 on Nov 12, 2025 be?
const correctDate = new Date(2025, 10, 12, 12, 13, 54); // Month is 0-indexed
console.log('\nExpected (12:13:54 on Nov 12, 2025):');
console.log('Correct date:', correctDate);
console.log('Correct timestamp:', correctDate.getTime());
console.log('Difference:', correctDate.getTime() - timestamp);
console.log('Difference in hours:', (correctDate.getTime() - timestamp) / (1000 * 60 * 60));
