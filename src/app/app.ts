import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// CalculatorComponent is now loaded via router, so remove direct import if not needed elsewhere in app.ts logic
// import { CalculatorComponent } from './calculator/calculator.component'; 

@Component({
  selector: 'app-root',
  imports: [RouterOutlet], // CalculatorComponent removed, RouterOutlet handles component display based on route
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'my';
}
