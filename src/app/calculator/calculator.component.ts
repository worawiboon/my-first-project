import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.css']
})
export class CalculatorComponent {
  display: string = '0'; // This is bound to the HTML template {{ display }}
  
  private currentInput: string = '0'; // Current number being typed or result of last op
  private firstOperand: number | null = null;
  private operator: string | null = null;
  private shouldResetDisplayForNextInput: boolean = false; // True after an operator is pressed or '='
  private lastOperationWasEquals: boolean = false;
  private lastSecondOperandForEquals: number | null = null;

  constructor() {
    this.updateDisplayFromCurrentInput();
  }

  private updateDisplayFromCurrentInput(): void {
    this.display = this.currentInput;
    // Basic overflow handling for display
    if (this.display.length > 12 && this.display !== 'Error') {
        try {
            const num = parseFloat(this.display);
            if (Math.abs(num) > 1e12 || (Math.abs(num) < 1e-9 && num !== 0)) {
                 this.display = num.toExponential(6);
            } else if (this.display.includes('.') && this.display.length > 12) {
                 // Simple truncation for long decimals for now
                 const parts = this.display.split('.');
                 if (parts.length === 2) {
                    const maxDecimalLength = 12 - parts[0].length - 1;
                    if (maxDecimalLength < 0) { // Integer part too long
                        this.display = num.toExponential(6);
                    } else {
                        this.display = parts[0] + '.' + parts[1].substring(0, Math.max(0, maxDecimalLength));
                    }
                 }
            } else if (!this.display.includes('.') && this.display.length > 12) { // Long integer
                this.display = num.toExponential(6);
            }
        } catch (e) {
            // Fallback or ignore error during display formatting
        }
    }
  }

  // Handles numeric digits (0-9) and decimal point (.) and operators
  append(char: string): void {
    if (['/', '*', '-', '+'].includes(char)) {
        this.pressOperator(char);
        return;
    }

    if (this.currentInput === 'Error') {
        this.currentInput = '0'; // Clear error on next valid input
    }

    if (this.shouldResetDisplayForNextInput) {
      this.currentInput = '0'; 
      this.shouldResetDisplayForNextInput = false;
    }
    this.lastOperationWasEquals = false;

    if (char === '.') {
      if (!this.currentInput.includes('.')) {
        this.currentInput += '.';
      }
    } else { // Numeric digit
      if (this.currentInput === '0') {
        this.currentInput = char;
      } else {
        // Prevent excessively long inputs before calculation
        if (this.currentInput.length < 20) { 
            this.currentInput += char;
        }
      }
    }
    this.updateDisplayFromCurrentInput();
  }

  pressOperator(op: string): void {
    if (this.currentInput === 'Error' && this.firstOperand === null) {
        this.currentInput = '0';
    }

    const inputValue = parseFloat(this.currentInput);
    this.lastOperationWasEquals = false;

    if (this.operator && this.firstOperand !== null && !this.shouldResetDisplayForNextInput) {
      if (this.currentInput === 'Error') {
          // Keep current operator and firstOperand, wait for valid second input
      } else {
          const result = this._performCalculation(this.firstOperand, inputValue, this.operator);
          if (this.currentInput === 'Error') { 
              this.firstOperand = null;
              this.operator = null;
              this.shouldResetDisplayForNextInput = true; 
              this.updateDisplayFromCurrentInput();
              return;
          }
          this.currentInput = String(result);
          this.firstOperand = result;
      }
    } else if (this.currentInput !== 'Error') {
      this.firstOperand = inputValue;
    } else if (this.currentInput === 'Error' && this.firstOperand !== null) {
      // Error state, but first operand exists (e.g. 5 / 0 = Error, then user presses '+')
      // Allow new operator to be set. firstOperand is still valid.
    }
    
    this.operator = op;
    this.shouldResetDisplayForNextInput = true; 
    this.updateDisplayFromCurrentInput(); 
  }

  calculate(): void {
    if (this.currentInput === 'Error') {
        this.shouldResetDisplayForNextInput = true; // Allow clearing error with next digit
        return;
    }
    
    let secondOperand: number;

    if (this.operator === null || this.firstOperand === null) {
      if (this.lastOperationWasEquals && this.operator && this.firstOperand !== null && this.lastSecondOperandForEquals !== null) {
          // Case: chained equals like 5 + 2 = (7), = (9), = (11)
          // this.firstOperand is previous result
          const result = this._performCalculation(this.firstOperand, this.lastSecondOperandForEquals, this.operator);
          if (this.currentInput !== 'Error') { // Error handled by _performCalculation
            this.currentInput = String(result);
            this.firstOperand = result; 
          }
          this.shouldResetDisplayForNextInput = true;
          this.updateDisplayFromCurrentInput();
          return;
      }
      // Not enough info for a new calculation, or just a number followed by '='
      this.shouldResetDisplayForNextInput = true;
      this.lastOperationWasEquals = true; // Set for potential chained equals if a number was displayed
      if (this.currentInput !== 'Error') {
          this.firstOperand = parseFloat(this.currentInput); // Make current number the first operand
          this.lastSecondOperandForEquals = this.firstOperand; // For 5 = = =
      }
      return;
    }


    if (this.shouldResetDisplayForNextInput && !this.lastOperationWasEquals) {
        // Handles cases like "5 + =", using the first operand as the second.
        secondOperand = this.firstOperand;
    } else {
        secondOperand = parseFloat(this.currentInput);
    }
    
    if (isNaN(secondOperand) ) {
        this.currentInput = 'Error';
        this.firstOperand = null;
        this.operator = null;
        this.shouldResetDisplayForNextInput = true;
        this.updateDisplayFromCurrentInput();
        return;
    }

    this.lastSecondOperandForEquals = secondOperand; // Store for repeated equals

    const result = this._performCalculation(this.firstOperand, secondOperand, this.operator);
    if (this.currentInput === 'Error') { 
        this.firstOperand = null; 
        this.operator = null;
    } else {
        this.currentInput = String(result);
        this.firstOperand = result; 
    }
    
    this.shouldResetDisplayForNextInput = true;
    this.lastOperationWasEquals = true;
    this.updateDisplayFromCurrentInput();
  }

  private _performCalculation(val1: number, val2: number, op: string): number {
    let result: number;
    switch (op) {
      case '+': result = val1 + val2; break;
      case '-': result = val1 - val2; break;
      case '*': result = val1 * val2; break;
      case '/':
        if (val2 === 0) {
          this.currentInput = 'Error';
          return NaN; 
        }
        result = val1 / val2;
        break;
      default:
        this.currentInput = 'Error'; 
        return NaN;
    }
    
    if (this.currentInput !== 'Error' && (isNaN(result) || !isFinite(result))) {
        this.currentInput = 'Error'; // e.g. calculation results in Infinity
        return NaN;
    }

    if (this.currentInput !== 'Error') {
        const precision = 10; // Adjust for desired decimal precision
        const factor = Math.pow(10, precision);
        if (String(result).includes('e')) { // If in exponential form, trust it
            return result;
        }
        return Math.round(result * factor) / factor;
    }
    return result; // result will be NaN if error occurred
  }

  clear(): void {
    this.currentInput = '0';
    this.firstOperand = null;
    this.operator = null;
    this.shouldResetDisplayForNextInput = false;
    this.lastOperationWasEquals = false;
    this.lastSecondOperandForEquals = null;
    this.updateDisplayFromCurrentInput();
  }
} 