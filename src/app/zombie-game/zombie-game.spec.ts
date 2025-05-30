import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZombieGame } from './zombie-game';

describe('ZombieGame', () => {
  let component: ZombieGame;
  let fixture: ComponentFixture<ZombieGame>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZombieGame]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ZombieGame);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
