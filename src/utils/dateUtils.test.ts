import { getLocalDateString, parseLocalDate } from './dateUtils';

function testDatePreservation() {
  const testCases = [
    '2025-09-18',
    '2025-01-01',
    '2025-12-31',
    '2024-02-29',
  ];

  let allPassed = true;

  testCases.forEach(dateStr => {
    const date = parseLocalDate(dateStr);
    const result = getLocalDateString(date);

    if (result !== dateStr) {
      console.error(`FAIL: Expected ${dateStr}, got ${result}`);
      allPassed = false;
    } else {
      console.log(`PASS: ${dateStr} preserved correctly`);
    }
  });

  if (allPassed) {
    console.log('\n✓ All date preservation tests passed!');
  } else {
    console.error('\n✗ Some tests failed!');
  }

  return allPassed;
}

const input = document.createElement('input');
input.type = 'date';
input.value = '2025-09-18';

console.log('Testing date input value preservation:');
console.log(`Input value: ${input.value}`);
console.log(`Expected: 2025-09-18`);
console.log(`Match: ${input.value === '2025-09-18'}`);

testDatePreservation();
