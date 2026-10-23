import type { SampleReport } from '../types';

export const SAMPLE_REPORTS: SampleReport[] = [
  {
    id: 'traffic-pileup',
    title: 'Highway Multi-Vehicle Pileup',
    category: 'Traffic',
    tag: 'Eyewitness Report',
    expectedStatus: 'Unverified',
    reportText:
      'OMGGG avoid I-80 eastbound right by exit 142 near the river bend! Massive multi-car pileup, two semi-trucks jackknifed across all 3 lanes, debris everywhere. Saw thick black smoke about 15 minutes ago. Traffic is completely stopped for at least 4 miles back! Emergency sirens heard in distance.',
  },
  {
    id: 'weather-flood',
    title: 'Flash Flood Road Submersion',
    category: 'Weather',
    tag: 'Urgent Civilian Observation',
    expectedStatus: 'Unverified',
    reportText:
      'Water is rising super fast on lower Mill Road directly under the railroad bridge. A red sedan got stalled out in deep standing water up to its door handles about 20 mins ago. Mill Creek overflowed after that torrential cloudburst. Avoid this underpass, do not drive through!',
  },
  {
    id: 'civic-watermain',
    title: 'Urban Water Main Rupture',
    category: 'Civic Issue',
    tag: 'Infrastructure Failure',
    expectedStatus: 'Unverified',
    reportText:
      'Major water main rupture at the corner of Elm Street and 4th Avenue. Water is spewing 10 feet into the air and eroding the asphalt near the sidewalk curb. Basements on the odd-numbered side of the block are taking on water since around 7:45 AM. No municipal utility truck on scene yet.',
  },
  {
    id: 'vague-sirens',
    title: 'Unspecified Sirens & Disturbance',
    category: 'Other',
    tag: 'Incomplete / Vague Chatter',
    expectedStatus: 'Needs More Information',
    reportText:
      'Did anyone else just hear crazy loud bangs and then continuous sirens somewhere on the south side about 10 minutes ago?? Saw two patrol cars fly by, something big happened but nobody knows where or what.',
  },
  {
    id: 'verified-alert',
    title: 'Official City Evacuation Alert',
    category: 'Public Safety',
    tag: 'Official Dispatch Corroborated',
    expectedStatus: 'Verified',
    reportText:
      'Official City Alert issued at 9:15 AM: Confirmed natural gas main breach on 200 block of Washington St between 2nd & 3rd Ave. Fire Dispatch CAD #2026-8841 on-scene. Mandatory 300-foot safety perimeter established. Local residents evacuated.',
  },
];
