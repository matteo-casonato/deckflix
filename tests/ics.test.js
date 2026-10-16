import { describe, expect, it } from 'vitest';
import { eventPageUrl, parseIcs, upcoming } from '../src/lib/domain/ics.js';

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
