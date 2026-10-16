import { describe, expect, it } from 'vitest';
import { cityName, distanceKm, eventPageUrl, nearby, parseEventsJson, parseIcs, tournamentType, upcoming, within } from '../src/lib/domain/ics.js';

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:b@pokedata',
  'DTSTART:20261007T190000',
  'SUMMARY:',
  'LOCATION:MAGIC WARRIOR MESTRE',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a@pokedata',
  'DTSTART:20260801T1530',
  'SUMMARY:Local GiOlly Comics 01/08/2026',
  'LOCATION:GIOLLY COMICS',
  'DESCRIPTION:Details and Registration: 26-08-008035',
  'URL:26-08-008035',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:c@pokedata',
  'DTSTART;TZID=Europe/Rome:20261120T100000',
  'SUMMARY:TCG LEAGUE CHALLENGE - IL MONDO \\, DI MIKY con un titolo lungo che',
  '  continua sulla riga dopo',
  'LOCATION:IL MONDO DI MIKY',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('parseIcs', () => {
  const list = parseIcs(ICS);
  it('reads events sorted by date, with 4-digit times and event codes', () => {
    expect(list.map((t) => [t.start, t.place, t.code])).toEqual([
      ['2026-08-01T15:30', 'GIOLLY COMICS', '26-08-008035'],
      ['2026-10-07T19:00', 'MAGIC WARRIOR MESTRE', null],
      ['2026-11-20T10:00', 'IL MONDO DI MIKY', null],
    ]);
  });
  it('joins folded lines, unescapes text and accepts parameters on DTSTART', () => {
    expect(list[2].title).toBe('TCG LEAGUE CHALLENGE - IL MONDO , DI MIKY con un titolo lungo che continua sulla riga dopo');
    expect(list[1].title).toBe('');
  });
  it('keeps only events from today on', () => {
    expect(upcoming(list, new Date(2026, 9, 7, 22).getTime()).map((t) => t.place)).toEqual(['MAGIC WARRIOR MESTRE', 'IL MONDO DI MIKY']);
  });
});

describe('eventPageUrl', () => {
  it('links the official event page', () => {
    expect(eventPageUrl('26-08-008035')).toBe('https://www.pokemon.com/us/play-pokemon/pokemon-events/26-08-008035/');
  });
});

describe('pokedata JSON', () => {
  const json = JSON.stringify([
    { id: 'x', title: 'Collector House Portogruaro - Challenge Pokemon Ottobre', when: '2026-10-17 15:30:00', shopName: 'COLLECTOR HOUSE PORTOGRUARO', city: 'Portogruaro', lat: 45.7752, lng: 12.8369, pokemon_url: '26-10-012590', game: 'tcg', type: 'challenges' },
    { id: 'y', title: '', when: '2026-10-16 19:00:00', shopName: 'LUDI&CO', city: 'San Dona di Piave', lat: 45.6298, lng: 12.5694, pokemon_url: '', game: 'tcg', type: 'friendly' },
    { id: 'z', title: 'VG', when: '2026-10-16 10:00:00', shopName: 'X', game: 'vg', type: 'cups' },
  ]);
  it('reads shop, city, position, type and code; keeps only the card game', () => {
    expect(parseEventsJson(json).map((t) => [t.start, t.city, t.type, t.code])).toEqual([
      ['2026-10-16T19:00', 'San Dona di Piave', 'league', null],
      ['2026-10-17T15:30', 'Portogruaro', 'challenge', '26-10-012590'],
    ]);
  });
  it('guesses the type from the title for the .ics file', () => {
    expect(tournamentType(undefined, 'TCG LEAGUE CHALLENGE - IL MONDO DI MIKY')).toBe('challenge');
    expect(tournamentType(undefined, 'Pokémon League Cup Novembre')).toBe('cup');
    expect(tournamentType(undefined, 'Pre-release Megaevoluzione')).toBe('prerelease');
    expect(tournamentType(undefined, '')).toBe('league');
    expect(tournamentType(undefined, 'League Cup e Challenge di novembre')).toBe('cup');
    expect(tournamentType('challenges', 'Collector House - Challenge Pokemon Ottobre')).toBe('challenge');
    expect(tournamentType('friendly', '')).toBe('league');
    expect(tournamentType(undefined, 'Sfida di Lega Ottobre')).toBe('challenge');
    expect(tournamentType(undefined, 'Coppa di Lega Pokémon')).toBe('cup');
    expect(tournamentType(undefined, 'Sfida di lega e Coppa di lega')).toBe('cup');
  });
  it('measures distances and keeps the next two weeks', () => {
    expect(Math.round(distanceKm({ lat: 45.6297, lng: 12.5682 }, { lat: 45.4064, lng: 11.8768 }))).toBe(59); // San Donà–Padova
    const list = parseEventsJson(json);
    expect(within(list, new Date(2026, 9, 16, 8).getTime(), 0).map((t) => t.id)).toEqual(['y']);
    expect(within(list, new Date(2026, 9, 16, 8).getTime(), 14)).toHaveLength(2);
  });
  it('keeps the tournaments within the radius, with their distance', () => {
    const home = { lat: 45.6297, lng: 12.5682 }; // San Donà
    const list = parseEventsJson(json);
    expect(nearby(list, home, 20).map((t) => [t.id, Math.round(t.km ?? -1)])).toEqual([['y', 0]]);
    expect(nearby(list, home, 50).map((t) => t.id)).toEqual(['y', 'x']);
    expect(nearby([{ ...list[0], lat: undefined, lng: undefined }], home, 1)[0].km).toBe(null);
  });
});

describe('cityName', () => {
  it('keeps the Italian name of bilingual and English city names', () => {
    expect(cityName('Udine / Udin')).toBe('Udine');
    expect(cityName('San Vito al Tagliamento / San Vit dal Tiliment')).toBe('San Vito al Tagliamento');
    expect(cityName('Padua')).toBe('Padova');
    expect(cityName('Triest')).toBe('Trieste');
    expect(cityName('Cittadella')).toBe('Cittadella');
    expect(cityName('')).toBe(undefined);
  });
});
