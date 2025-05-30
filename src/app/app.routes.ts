import { Routes } from '@angular/router';
import { CalculatorComponent } from './calculator/calculator.component';
import { ZombieGameComponent } from './zombie-game/zombie-game.component';
import { HomeComponent } from './home/home'; // Adjusted import path if necessary
import { AboutMe } from './about-me/about-me'; // Corrected class name to AboutMe

export const routes: Routes = [
    { path: '', component: HomeComponent, pathMatch: 'full' }, // Default to Home
    { path: 'home', component: HomeComponent }, // Optional: explicit /home route
    { path: 'calculator', component: CalculatorComponent },
    { path: 'zombie-game', component: ZombieGameComponent },
    { path: 'about-me', component: AboutMe }, // Use correct class name AboutMe
    // You could also redirect empty path to /home if you prefer that structure
    // { path: '', redirectTo: '/home', pathMatch: 'full' },
];
