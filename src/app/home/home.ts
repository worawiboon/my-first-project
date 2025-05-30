import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  imageUrls: string[] = [
    'assets/images/1.png',
    'assets/images/2.png'
  ];
  currentImageIndex: number = 0;
  private slideInterval: any;
  private readonly slideDuration: number = 5000; // ms

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.startImageSlider();
  }

  ngOnDestroy(): void {
    this.clearSlideInterval();
  }

  clearSlideInterval(): void {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
      this.slideInterval = null; // Ensure it's marked as cleared
    }
  }

  startImageSlider(): void {
    this.clearSlideInterval(); // Clear existing interval before starting a new one
    this.slideInterval = setInterval(() => {
      this.nextImage(false); // Call nextImage to handle index update and CDR
    }, this.slideDuration);
  }

  prevImage(manualInteraction: boolean = true): void {
    if (manualInteraction) this.resetSlideInterval();
    this.currentImageIndex = (this.currentImageIndex - 1 + this.imageUrls.length) % this.imageUrls.length;
    this.cdr.detectChanges();
  }

  nextImage(manualInteraction: boolean = true): void {
    if (manualInteraction) this.resetSlideInterval();
    this.currentImageIndex = (this.currentImageIndex + 1) % this.imageUrls.length;
    this.cdr.detectChanges();
  }

  goToImage(index: number): void {
    this.resetSlideInterval();
    this.currentImageIndex = index;
    this.cdr.detectChanges();
  }

  resetSlideInterval(): void {
    this.clearSlideInterval();
    // Optionally restart the interval after a manual interaction
    // For now, manual interaction stops the automatic slideshow to prevent jumpiness.
    // If you want it to restart, call this.startImageSlider() here, perhaps after a timeout.
    // For example, after 10 seconds of inactivity:
    // if (this.timeoutId) clearTimeout(this.timeoutId);
    // this.timeoutId = setTimeout(() => this.startImageSlider(), 10000);
  }
}
