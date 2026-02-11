// Quick test for Jan 17-20, 2026
const start = new Date(2026, 0, 17); // Jan 17
const end = new Date(2026, 0, 20);   // Jan 20

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

console.log('\nActual dates: Jan 17-20, 2026:');
console.log('='.repeat(40));

const current = new Date(start);
const dates = [];
while (current <= end) {
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    const dayName = dayNames[current.getDay()];
    console.log(`${dateStr} = ${dayName}`);
    dates.push({ dateStr, day: current.getDay() });
    current.setDate(current.getDate() + 1);
}

console.log('\n6-day work week calculation:');
console.log('='.repeat(40));
let total = 0;
dates.forEach(({ dateStr, day }) => {
    let weight = 1;

    if (day === 0) { // Sunday
        weight = 0;
        console.log(`${dateStr} (${dayNames[day]}): Weekend - NOT counted (weight 0)`);
    } else if (day === 6) { // Saturday
        weight = 1;
        console.log(`${dateStr} (${dayNames[day]}): Working day - counted (weight 1)`);
    } else {
        weight = 1;
        console.log(`${dateStr} (${dayNames[day]}): Working day - counted (weight 1)`);
    }

    total += weight;
});

console.log('='.repeat(40));
console.log(`EXPECTED TOTAL: ${total} days (for 6-day work week)`);
console.log(`YOU ARE SEEING: 4 days`);
console.log(`\n${total === 4 ? '⚠️  PROBLEM: Sunday is being counted as a working day!' : '✅ Correct calculation'}`);
