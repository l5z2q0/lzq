let display = '0';
let firstOperand = null;
let operator = null;
let waitingForSecondOperand = false;

function updateDisplay() {
    const displayElement = document.getElementById('calc-display');
    displayElement.textContent = display;
}

function inputDigit(digit) {
    if (waitingForSecondOperand) {
        display = digit;
        waitingForSecondOperand = false;
    } else {
        display = display === '0' ? digit : display + digit;
    }
    updateDisplay();
}

function inputDecimal() {
    if (!display.includes('.')) {
        display += '.';
        updateDisplay();
    }
}

function clearDisplay() {
    display = '0';
    firstOperand = null;
    operator = null;
    waitingForSecondOperand = false;
    updateDisplay();
}

function toggleSign() {
    display = display.startsWith('-') ? display.slice(1) : '-' + display;
    updateDisplay();
}

function inputPercent() {
    const value = parseFloat(display);
    display = (value / 100).toString();
    updateDisplay();
}

function performOperation(nextOperator) {
    const inputValue = parseFloat(display);
    
    if (firstOperand === null) {
        firstOperand = inputValue;
    } else if (operator) {
        const result = calculate(firstOperand, operator, inputValue);
        display = result.toString();
        firstOperand = result;
    }
    
    waitingForSecondOperand = true;
    operator = nextOperator;
    updateDisplay();
    incrementCalcCount();
}

function calculate(first, op, second) {
    switch (op) {
        case '+':
            return first + second;
        case '-':
            return first - second;
        case '*':
            return first * second;
        case '/':
            return first / second;
        default:
            return second;
    }
}

function incrementCalcCount() {
    const count = Toolbox.getFromStorage(Toolbox.STORAGE_KEYS.CALC_COUNT, 0);
    Toolbox.saveToStorage(Toolbox.STORAGE_KEYS.CALC_COUNT, count + 1);
}

function handleButtonClick(value) {
    if (value >= '0' && value <= '9') {
        inputDigit(value);
    } else if (value === '.') {
        inputDecimal();
    } else if (value === 'C') {
        clearDisplay();
    } else if (value === '+/-') {
        toggleSign();
    } else if (value === '%') {
        inputPercent();
    } else if (value === '=') {
        performOperation(null);
    } else {
        performOperation(value);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.calc-btn');
    
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            handleButtonClick(button.textContent.trim());
        });
    });
});