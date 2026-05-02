import React, { useState, useEffect } from 'react';
import { useRecentEmails } from '../../hooks/useRecentEmails';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Trash2, Link as LinkIcon, Mail, FileSignature, Edit2, X, Check, Plus } from 'lucide-react';

import { toast } from 'sonner';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';

interface PolicyEntry {
  id: string;
  title: string;
  content: string;
  color: 'red' | 'amber' | 'green' | 'blue' | 'indigo' | 'slate';
}

const COLOR_OPTIONS = [
  { label: 'Critical (Red)', value: 'red' },
  { label: 'Warning (Amber)', value: 'amber' },
  { label: 'Positive (Green)', value: 'green' },
  { label: 'Info (Blue)', value: 'blue' },
  { label: 'Primary (Indigo)', value: 'indigo' },
  { label: 'Neutral (Slate)', value: 'slate' },
] as const;

const COLOR_MAP: Record<string, string> = {
  red: 'bg-red-50 text-red-700 border-red-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  green: 'bg-green-50 text-green-700 border-green-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  slate: 'bg-slate-50 text-slate-700 border-slate-100',
};

const DEFAULT_CONTRACT_TEMPLATE = `Contract ID: {{CONTRACT_ID}}						Date: {{DATE}}

To: {{CLIENT_NAME}}
{{ADDRESS}}
Cell: {{PHONE}}
Email: {{EMAIL}}

Sub: Accommodation and banquet event contract between {{CLIENT_NAME}} & Pramod Lands End, Gopalpur for the Residential Wedding of {{EVENT_NAME}} on {{EVENT_DATES}}

Dear {{CLIENT_NAME}},

Thank you for choosing Pramod Lands End, Gopalpur. According to your requirements, we are happy to confirm the following rates and arrangements for "{{EVENT_NAME}}" residential wedding.

(i) Accommodations
(Room types, charges with inclusions/exclusions)	Annexure - A
(ii) Food & Beverage arrangements
(Banquet Venue, Food & Beverage details, flow of events, others)	Annexure - B
(iii) Schedule of payments, cancellation policy
(Reservation, Cancellation & Payment modalities)	Annexure - C
(iv) Most important terms and conditions	Annexure - D

Dates	Event Name	Minimum Guaranteed Event Revenue
{{EVENT_DATES}}	Residential Wedding of "{{EVENT_NAME}}"	Rs. {{AMOUNT}} + GST

If this contract accurately sets forth the understanding and agreement between us, please indicate your acceptance by signing and returning a copy of this contract and furnishing the initial deposit.

For Padma Eastern Hotels Pvt Ltd	I understand and accept the contract.


Amit Sahu
Manager - Sales
Pramod Lands End, Gopalpur
Contact No: +91 9040084866
Email: amit.sahu@pramodresorts.com	

{{CLIENT_NAME}}
{{ADDRESS}}
Cell: {{PHONE}}
Email: {{EMAIL}}

Annexure- A
ACCOMMODATION:

Sunday, 26 November, 2023
Accommodation	Rooms	Pax	Tariff	Total	GST%	GST	Amount
Queens Court	16	32	8,000	1,28,000	18%	23,040	1,51,040
Kings Court	8	16	10,000	80,000	18%	14,400	94,400
Family Suite	3	12	12,000	36,000	18%	6,480	42,480
Family Executive Suite	3	12	12,000	36,000	18%	6,480	42,480
Classic Suite	7	28	12,000	84,000	18%	15,120	99,120
Extra persons		20	2,000	40,000	18%	7,200	47,200
Day total accommodation	37	120		4,04,000		72,720	4,76,720

Monday, 27 November, 2023
Accommodation	Rooms	Pax	Tariff	Total	GST%	GST	Amount
Queens Court	16	32	8,000	1,28,000	18%	23,040	1,51,040
Kings Court	8	16	10,000	80,000	18%	14,400	94,400
Family Suite	3	12	12,000	36,000	18%	6,480	42,480
Family Executive Suite	3	12	12,000	36,000	18%	6,480	42,480
Classic Suite	7	28	12,000	84,000	18%	15,120	99,120
Extra persons		20	2,000	40,000	18%	7,200	47,200
Day total Accommodation	37	120		4,04,000		72,720	4,76,720

Tuesday, 28 November, 2023
Accommodation	Rooms	Pax	Tariff	Total	GST%	GST	Amount
Queens Court	0	32	8,000	0	18%	0	0
Kings Court	0	0	10,000	0	18%	0	0
Family Suite	0	0	12,000	0	18%	0	0
Family Executive Suite	0	0	12,000	0	18%	0	0
Classic Suite	0	0	12,000	0	18%	0	0
Extra persons	0	20	2,000	40,000	18%	7,200	47,200
Day total Accommodation				40,000		7,200	47,200

A1.	GST as applicable shall be additional to above tariffs.
A2.	Room service, laundry, spa services, bar and travel services will be billed separately and must be settled on a direct payment basis by guests.
A3.	As this is an event with complete inventory buyout, reduction in rooms is not permissible. The rooms subtotal shall still be payable in full, as we will not be able to sell the remaining room inventory to other guests.
A4.	Our standard check-in time is 2 pm. For early arrivals before 10 am, we advise you to reserve rooms from the previous night. 
A5.	Our standard check-out time is 11 am. Late departures after 2 pm will be subject to our late check out fee. Departures after 5 pm will be charged for the full day.
A6.	Any requirement for rooms on 20 Jan, 2024 and 23 Jan, 2024 will be charged as per the above tariffs on bed and breakfast plan.
A7.	These tariffs are valid for 21 Jan, 2024 and 22 Jan, 2024 only. In case the dates of event change the tariff will also be revised accordingly.
A8.	Please share your room wise guest occupancy with names along with ID cards by 17 Jan, 2023 for hassle free check in.
Inclusions:
●	Non-alcoholic welcome drink on arrival.
●	Accommodation on a double sharing basis.
●	Buffet breakfast at our restaurant. (Not applicable on the day of arrival)
●	Packaged drinking water, tea/coffee maker with the supplies of tea bags, coffee powder, sugar, and milk sachets.
●	Complimentary wi-fi (2MBPS speed) in rooms, free usage swimming pool from 08:00 am to 08:00 pm.

Annexure- B
FOOD & BEVERAGE:
Sunday, 26 November, 2023
Food & Beverage	Venue	Pax	Tariff	Total	GST%	GST	Amount
Breakfast (included)	Smoke House	100	0	0	18%	0	0
Breakfast (chargeable)	Smoke House	30	500	15,000	18%	2,700	17,700
Lunch	Emerald	130	1,800	2,34,000	18%	42,120	2,76,120
Ritual Snacks	Courtyard	130	700	91,000	18%	16,380	1,07,380
Hi Tea	Courtyard	130	700	91,000	18%	16,380	1,07,380
Dinner	Lawn	180	2,200	3,96,000	18%	71,280	4,67,280
Day total F&B				8,27,000		1,48,860	9,75,860

Monday, 27 November, 2023
Food & Beverage	Venue	Pax	Tariff	Total	GST%	GST	Amount
Breakfast (included)	Smoke House	100	0	0	18%	0	0
Breakfast (chargeable)	Smoke House	30	500	15,000	18%	2,700	17,700
Lunch	Emerald	130	1,800	2,34,000	18%	42,120	2,76,120
Ritual Snacks	Courtyard	130	700	91,000	18%	16,380	1,07,380
Hi Tea	Courtyard	130	700	91,000	18%	16,380	1,07,380
Dinner	Lawn	180	2,200	3,96,000	18%	71,280	4,67,280
Day total F&B				8,27,000		1,48,860	9,75,860

Tuesday, 28 November, 2023
Food & Beverage	Venue	Pax	Tariff	Total	GST%	GST	Amount
Breakfast (included)	Smoke House	100	0	0	18%	0	0
Breakfast (chargeable)	Smoke House	50	500	25,000	18%	4,500	29,500
Lunch							
Food Packets		40	500	20,000	18%	3,600	23,600
Vendor fees		1	50,000	50,000	18%	9,000	59,000
Day total F&B				95,000		17,100	1,12,100

B1.	GST as applicable shall be additional to above tariffs.
B2.	These tariffs are for the minimum guaranteed persons as stated above. Even in case of reduction in the number of persons, the F&B sub total shall still be payable in full, as significant fixed costs in delivering F&B services are incurred by the hotel irrespective of the number of attending guests.
B3.	These tariffs are valid for 21 Jan, 2024 and 22 Jan, 2024 only. In case the dates of event change the tariff will also be revised accordingly.
Inclusions:
●	All day tea coffee counter from 8 am to 8 pm with Cookies, Toast & Butter.
●	Two live counters at all major meals
●	Dry fruits for pass around / return gifts / packed sweets / packed breakfast / lunch are not included in the above tariff.
Flow of Events:

Date	Event details
21st Jan 2024	10 am onwards: Check in
1 pm to 3 pm: Bhaat with lunch at Fortress
4 pm to 6 pm: Hi-tea and snacks at Terrace
7 pm onwards: Sangeet with ritual snacks followed by dinner at the Lawn
22nd Jan 2024	7:30 am to 10:30 am: Breakfast at The Khao Galli.
11 am to 12 noon: Haldi with mocktails and snacks at Clifftop
2 pm to 5 pm: Wedding and lunch at the Fortress
4 pm to 6 pm: Hi-tea and snacks at Terrace
7:30 pm onwards: Cocktail Dinner at the Lawn
23rd Jan 2024	7:30 am to 10:30 am: Breakfast at The Khao Galli
11 am: Check out

Annexure- C
SCHEDULE OF PAYMENTS:

Date	Description	Total	GST	Amount
Sunday, 26 November, 2023	Accommodation	4,04,000	72,720	4,76,720
Monday, 27 November, 2023	Accommodation	4,04,000	72,720	4,76,720
Tuesday, 28 November, 2023	Accommodation	40,000	7,200	47,200
Sunday, 26 November, 2023	F&B	8,27,000	1,48,860	9,75,860
Monday, 27 November, 2023	F&B	8,27,000	1,48,860	9,75,860
Tuesday, 28 November, 2023	F&B	95,000	17,100	1,12,100
Minimum guaranteed revenue for event		25,97,000	4,67,460	30,64,460

BANKING INFORMATION:

C1.	A security deposit @ 5% of the base total is payable by the event manager / decorator to the hotel. The same shall be refundable after verification of any damages to the property. In case of non payment by the due date, we will be unable to permit the event manager / decorator from entering our premises. 
C2.	Please be reminded that 100% of the prepayment of the minimum guaranteed event revenue must be received before the group’s first arrival.  In case of partial payments, please note we will not be able to check in your guests without confirmation of all payments being cleared.
C3.	If payment schedules are not adhered to, Pramod Lands End reserves the right to cancel this booking and proceed with refunds as per the below cancellation policy without liability.
C4.	We do not accept payment by cheques.

CANCELLATIONS/ AMENDMENTS/ RETENTION CHARGES:
C5.	In the unfortunate event of your planned celebrations being cancelled, the following cancellation policy shall be enforced: 
Cancellation/ Amendment	Refund policy
Prior to 90 days to the scheduled event date	100% advance will be refunded.
Between 46 to 90 days of the scheduled date	50% advance will be refunded.
Before 45 days to the scheduled event date	No refund


Annexure- D

MOST IMPORTANT TERMS - ACCOMMODATIONS:
D1.	For partial inventory buyout, any reduction in the original block of rooms must be informed 14 days prior to the scheduled arrival date. Any amendments/reductions initiated within 14 days of the arrival date will be charged in full.
D2.	Please share your room wise guest occupancy with names along with ID cards 3 days before the event for hassle free check in.

MOST IMPORTANT TERMS - FOOD & BEVERAGE:
D3.	The above-mentioned rates are quoted on the basis of the menu matrix selected, attached and agreed. The rates are valid for this function/ event and the scheduled date only. 
D4.	Minor alterations on the menu shall be accommodated if done 7 days before the event. Addition of items will be charged extra as per our banquet prices.
D5.	We do not serve alcohol in the hotel premises. 
D6.	Food prepared for events is prepared in bulk and has a short life. In view of safety, we do not permit parcels/ packed foods/ take away buffet food. The same is prepared a-la-carte, packaged and handed over to guests. Please share such requirements in advance.
D7.	All snacks shall be served for 90 minutes from the time decided by the host.
D8.	 All food & beverage has to be sourced from the hotel. To ensure your safety, outside food, beverages and food vendors are not allowed to be a part of the event. In case you have any preferences towards any specific vendor, please advise, we shall procure the same for you.

MOST IMPORTANT TERMS - DECORATION / EVENT MANAGER
D9.	The hotel’s scope of services is limited to accommodation AND food and beverage. Everything else shall fall upon the guest or the event manager’s scope.
D10.	The event manager / host must submit a permission from Gopalpur Police Station for conducting any event on the sand dunes or undertaking any street procession.
D11.	Only the use of paper confetti is permitted. To protect the sea coast from pollution by single use plastic, the use of plastic confetti is prohibited.
D12.	The event manager / decorator must arrange for generator power supply for all the light, sound, stage requirements. The hotel reserves the right to stop the event manager from connecting any equipment to the hotel’s power supply as the hotel infrastructure is not designed to handle the same.
D13.	The use of fireworks indoors or any kind of fire shows inside the hotel premises is strictly prohibited.
D14.	The event manager / decorator shall be permitted to set up only 24 hours prior to guest check in, subject to payment of security deposit. For earlier access, entry will be subject to availability. For guaranteed access, venue rentals shall be payable.
D15.	All equipment and set-up must be dismantled and cleared from the hotel premises within 24 hours of the event end time.
D16.	No live animals will be allowed in the hotel at any time.
D17.	Hazardous substances, flammable substances, firearms, weapons of any sort are not permitted inside the hotel premises.
D18.	No permanent alterations are allowed, including nails or hooks in the walls, roof or frames. Any damage to the hotel including linen wear and tear will be charged accordingly. The guests shall not be entitled to paint, affix or attach any matter to the walls of the function room.

MOST IMPORTANT TERMS - LIMITS ON HOTEL’S LIABILITIES
D19.	The hotel will not be responsible for any kind of damage, loss or theft of valuables. Please use the safety lockers provided in the rooms.
D20.	The hotel does not guarantee the safety of children. Guests must ensure the safety of their children, especially around the pool, elevators, stairways, terrace, glass railings, reflection pool, parking area, etc.
D21.	The hotel, its employees will not be held liable for any loss of/or damage to guests’ property while utilising this facility, any personal injury sustained, harm caused in whatever manner, or death caused due to personal injuries by negligence of guest’s. Minor children remain the responsibility of the parents/ guardians and must at all times be accompanied by a responsible adult whilst using the hotel/ pool deck and other facilities.
D22.	Force majeure: In the event of any disaster/ Act of God / major breakdowns in the hotel due to unforeseen circumstances, and the inability of the hotel to conduct the event, the hotel management reserves the right to amend/ cancel the booking. On cancellations of booking by the Hotel, the guest/  booker/ organizer will be refunded the advance paid within 7  working days without any interest. The hotel shall not be liable for making alternative arrangements, nor shall the hotel be liable to compensate the guest/ booker/ organizer for any losses financial or otherwise.
D23.	Proof of Identity with address (issued by the Government of India) of every guest is required upon check-in as per government regulations. For foreign nationals, a passport with a valid visa is required; failing to submit the copy of the id proof, the hotel has the right to deny the check-in on arrival. 
D24.	Children under the age of 18 may be accommodated only with the consent of their parents.
D25.	All government policies/ regulations prevalent during the time of the conference/ event shall apply.
D26.	All disputes will be subject to the jurisdiction as per the laws prevalent in Odisha at the time of signing the contract.`;

export default function ContractBuilderPage() {

  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const bookingId = searchParams.get('booking_id');
  const corporateId = searchParams.get('corporate_account_id');
  
  const { selectedPropertyId } = useProperty();

  const [status, setStatus] = useState('draft');
  const [terms, setTerms] = useState(DEFAULT_CONTRACT_TEMPLATE);
  const [flow, setFlow] = useState('hotel_proposes');
  const [paymentDeadline, setPaymentDeadline] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [totalValue, setTotalValue] = useState(0);
  const [policies, setPolicies] = useState<{ policy_list: PolicyEntry[] }>({ policy_list: [] });
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PolicyEntry | null>(null);
  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [newPolicy, setNewPolicy] = useState<Omit<PolicyEntry, 'id'>>({
    title: '',
    content: '',
    color: 'slate',
  });


  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailData, setEmailData] = useState({ to_email: '', cc_email: '', subject: 'Formal Contract Details from Hotel Pramod', body: '' });
  const { recentEmails, addEmail } = useRecentEmails();

  const isEditing = Boolean(id);

  const explicitBookingId = searchParams.get('booking_id');
  const explicitBanquetBookingId = searchParams.get('banquet_booking_id');

  const { data: banquetBookings } = useQuery({
    queryKey: ['banquet_bookings_all', selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return { banquet_bookings: [] };
      const res = await apiClient.get(`/api/banquet/banquet-bookings`, { params: { property_id: selectedPropertyId } });
      return res.data;
    },
    enabled: !!selectedPropertyId,
  });

  const activeBanquet = explicitBanquetBookingId ? banquetBookings?.banquet_bookings?.find((b: any) => b.id === Number(explicitBanquetBookingId)) : null;
  const derivedBookingId = explicitBookingId || activeBanquet?.linked_booking_id?.toString() || null;

  const { data: crsBooking } = useQuery({
    queryKey: ['booking', derivedBookingId],
    queryFn: async () => {
      if (!derivedBookingId) return null;
      const res = await apiClient.get(`/api/crs/bookings/${derivedBookingId}`);
      return res.data;
    },
    enabled: !!derivedBookingId,
  });

  const handleAutofill = () => {
    const bData = crsBooking?.booking;
    const lines = crsBooking?.lines || [];
    
    const clientName = bData?.guest_name || bData?.booker_name || '[Client Name]';
    const address = bData?.address || '[Address]';
    const phone = bData?.guest_phone || bData?.booker_phone || '[Phone]';
    const email = bData?.guest_email || bData?.booker_email || '[Email]';
    let totalAmount = Number(bData?.total_amount || 0);
    
    const linkedBanquets = banquetBookings?.banquet_bookings?.filter((b: any) => 
      (derivedBookingId && b.linked_booking_id === Number(derivedBookingId)) || b.id === Number(explicitBanquetBookingId)
    ) || [];

    const eventName = linkedBanquets.length > 0 ? (linkedBanquets[0].event_sub_type || linkedBanquets[0].event_category || 'Event').toUpperCase() : 'Event';
    const eventDates = linkedBanquets.length > 0 ? linkedBanquets[0].event_date : (bData?.check_in || '[Dates]');

    let annexureA = '';
    if (lines.length > 0) {
      annexureA += 'Accommodation\tRooms\tTariff\tTotal\n';
      lines.forEach((line: any) => {
        annexureA += `${line.room_type_name}\t${line.quantity}\t${Number(line.rate).toLocaleString('en-IN')}\t${(Number(line.rate) * line.quantity).toLocaleString('en-IN')}\n`;
      });
    } else {
      annexureA = '[Insert Accommodation Details/Tables Here]';
    }

    let annexureB = '';
    if (linkedBanquets.length > 0) {
      annexureB += 'Food & Beverage\tVenue\tPax\tTariff\tTotal\tGST%\tGST\tAmount\n';
      linkedBanquets.forEach((b: any) => {
        let pricing = typeof b.pricing === 'string' ? JSON.parse(b.pricing) : (b.pricing || {});
        let gstSplit = typeof b.gst_split === 'string' ? JSON.parse(b.gst_split) : (b.gst_split || {});
        let gstPct = gstSplit.gst_pct || (b.with_room ? 18 : 5);
        
        let pax = Number(b.guaranteed_pax || 0);
        let rate = Number(pricing.per_plate_rate || 0);
        let total = pax * rate;
        let gst = total * (gstPct / 100);
        let amount = total + gst;
        
        totalAmount += amount; // sum up banquet charges
        
        annexureB += `${(b.menu_package || b.event_sub_type || 'Event').replace('_', ' ')}\t${b.venue_name}\t${pax}\t${rate.toLocaleString('en-IN')}\t${total.toLocaleString('en-IN')}\t${gstPct}%\t${gst.toLocaleString('en-IN')}\t${amount.toLocaleString('en-IN')}\n`;
        
        // Venue/Hall charges
        let hallCharges = Number(pricing.hall_charges || 0) + Number(pricing.venue_charges || 0);
        if (hallCharges > 0) {
          let hGst = hallCharges * 0.18;
          let hAmount = hallCharges + hGst;
          totalAmount += hAmount;
          annexureB += `Venue Charges\t${b.venue_name}\t-\t-\t${hallCharges.toLocaleString('en-IN')}\t18%\t${hGst.toLocaleString('en-IN')}\t${hAmount.toLocaleString('en-IN')}\n`;
        }
      });
    } else {
      annexureB = 'No Food & Beverage details for this event.';
    }

    let newTerms = DEFAULT_CONTRACT_TEMPLATE;
    newTerms = newTerms.replace(/\{\{CLIENT_NAME\}\}/g, clientName);
    newTerms = newTerms.replace(/\{\{ADDRESS\}\}/g, address);
    newTerms = newTerms.replace(/\{\{PHONE\}\}/g, phone);
    newTerms = newTerms.replace(/\{\{EMAIL\}\}/g, email);
    newTerms = newTerms.replace(/\{\{EVENT_NAME\}\}/g, eventName);
    newTerms = newTerms.replace(/\{\{EVENT_DATES\}\}/g, eventDates);
    newTerms = newTerms.replace(/\{\{AMOUNT\}\}/g, Number(totalAmount).toLocaleString('en-IN'));
    newTerms = newTerms.replace(/\{\{CONTRACT_ID\}\}/g, '[Auto Generated]');
    newTerms = newTerms.replace(/\{\{DATE\}\}/g, new Date().toLocaleDateString('en-GB'));
    
    // A quick hack to replace the static table blocks if present
    // Since the user might have modified it, we just prepend the dynamic tables if they aren't empty, 
    // or we can just let them edit. Given complexity, replacing the entire template is safer.
    
    const dynamicTemplate = `Contract ID: [Auto Generated]						Date: ${new Date().toLocaleDateString('en-GB')}

To: ${clientName}
${address}
Cell: ${phone}
Email: ${email}

Sub: Accommodation and banquet event contract between ${clientName} & Pramod Lands End, Gopalpur for the Residential Wedding of ${eventName} on ${eventDates}

Dear ${clientName},

Thank you for choosing Pramod Lands End, Gopalpur. According to your requirements, we are happy to confirm the following rates and arrangements for "${eventName}" residential wedding.

(i) Accommodations
(Room types, charges with inclusions/exclusions)	Annexure - A
(ii) Food & Beverage arrangements
(Banquet Venue, Food & Beverage details, flow of events, others)	Annexure - B
(iii) Schedule of payments, cancellation policy
(Reservation, Cancellation & Payment modalities)	Annexure - C
(iv) Most important terms and conditions	Annexure - D

Dates	Event Name	Minimum Guaranteed Event Revenue
${eventDates}	Residential Wedding of "${eventName}"	Rs. ${Number(totalAmount).toLocaleString('en-IN')} + GST

If this contract accurately sets forth the understanding and agreement between us, please indicate your acceptance by signing and returning a copy of this contract and furnishing the initial deposit.

For Padma Eastern Hotels Pvt Ltd	I understand and accept the contract.


Amit Sahu
Manager - Sales
Pramod Lands End, Gopalpur
Contact No: +91 9040084866
Email: amit.sahu@pramodresorts.com	

${clientName}
${address}
Cell: ${phone}
Email: ${email}

Annexure- A
ACCOMMODATION:

${annexureA}

A1.	GST as applicable shall be additional to above tariffs.
A2.	Room service, laundry, spa services, bar and travel services will be billed separately and must be settled on a direct payment basis by guests.
A3.	As this is an event with complete inventory buyout, reduction in rooms is not permissible. The rooms subtotal shall still be payable in full, as we will not be able to sell the remaining room inventory to other guests.
A4.	Our standard check-in time is 2 pm. For early arrivals before 10 am, we advise you to reserve rooms from the previous night. 
A5.	Our standard check-out time is 11 am. Late departures after 2 pm will be subject to our late check out fee. Departures after 5 pm will be charged for the full day.
A6.	Any requirement for rooms will be charged as per the above tariffs on bed and breakfast plan.
A7.	These tariffs are valid for event dates only. In case the dates of event change the tariff will also be revised accordingly.
A8.	Please share your room wise guest occupancy with names along with ID cards for hassle free check in.
Inclusions:
●	Non-alcoholic welcome drink on arrival.
●	Accommodation on a double sharing basis.
●	Buffet breakfast at our restaurant. (Not applicable on the day of arrival)
●	Packaged drinking water, tea/coffee maker with the supplies of tea bags, coffee powder, sugar, and milk sachets.
●	Complimentary wi-fi (2MBPS speed) in rooms, free usage swimming pool from 08:00 am to 08:00 pm.

Annexure- B
FOOD & BEVERAGE:

${annexureB}

B1.	GST as applicable shall be additional to above tariffs.
B2.	These tariffs are for the minimum guaranteed persons as stated above. Even in case of reduction in the number of persons, the F&B sub total shall still be payable in full, as significant fixed costs in delivering F&B services are incurred by the hotel irrespective of the number of attending guests.
B3.	These tariffs are valid for event dates only. In case the dates of event change the tariff will also be revised accordingly.
Inclusions:
●	All day tea coffee counter from 8 am to 8 pm with Cookies, Toast & Butter.
●	Two live counters at all major meals
●	Dry fruits for pass around / return gifts / packed sweets / packed breakfast / lunch are not included in the above tariff.
Flow of Events:

Date	Event details
[Insert Flow of Events here]

Annexure- C
SCHEDULE OF PAYMENTS:

Date	Description	Total	GST	Amount
[Insert Schedule of Payments here]

Minimum guaranteed revenue for event		Rs. ${Number(amount).toLocaleString('en-IN')}

BANKING INFORMATION:

C1.	A security deposit @ 5% of the base total is payable by the event manager / decorator to the hotel. The same shall be refundable after verification of any damages to the property. In case of non payment by the due date, we will be unable to permit the event manager / decorator from entering our premises. 
C2.	Please be reminded that 100% of the prepayment of the minimum guaranteed event revenue must be received before the group’s first arrival.  In case of partial payments, please note we will not be able to check in your guests without confirmation of all payments being cleared.
C3.	If payment schedules are not adhered to, Pramod Lands End reserves the right to cancel this booking and proceed with refunds as per the below cancellation policy without liability.
C4.	We do not accept payment by cheques.

CANCELLATIONS/ AMENDMENTS/ RETENTION CHARGES:
C5.	In the unfortunate event of your planned celebrations being cancelled, the following cancellation policy shall be enforced: 
Cancellation/ Amendment	Refund policy
Prior to 90 days to the scheduled event date	100% advance will be refunded.
Between 46 to 90 days of the scheduled date	50% advance will be refunded.
Before 45 days to the scheduled event date	No refund


Annexure- D

MOST IMPORTANT TERMS - ACCOMMODATIONS:
D1.	For partial inventory buyout, any reduction in the original block of rooms must be informed 14 days prior to the scheduled arrival date. Any amendments/reductions initiated within 14 days of the arrival date will be charged in full.
D2.	Please share your room wise guest occupancy with names along with ID cards 3 days before the event for hassle free check in.

MOST IMPORTANT TERMS - FOOD & BEVERAGE:
D3.	The above-mentioned rates are quoted on the basis of the menu matrix selected, attached and agreed. The rates are valid for this function/ event and the scheduled date only. 
D4.	Minor alterations on the menu shall be accommodated if done 7 days before the event. Addition of items will be charged extra as per our banquet prices.
D5.	We do not serve alcohol in the hotel premises. 
D6.	Food prepared for events is prepared in bulk and has a short life. In view of safety, we do not permit parcels/ packed foods/ take away buffet food. The same is prepared a-la-carte, packaged and handed over to guests. Please share such requirements in advance.
D7.	All snacks shall be served for 90 minutes from the time decided by the host.
D8.	 All food & beverage has to be sourced from the hotel. To ensure your safety, outside food, beverages and food vendors are not allowed to be a part of the event. In case you have any preferences towards any specific vendor, please advise, we shall procure the same for you.

MOST IMPORTANT TERMS - DECORATION / EVENT MANAGER
D9.	The hotel’s scope of services is limited to accommodation AND food and beverage. Everything else shall fall upon the guest or the event manager’s scope.
D10.	The event manager / host must submit a permission from Gopalpur Police Station for conducting any event on the sand dunes or undertaking any street procession.
D11.	Only the use of paper confetti is permitted. To protect the sea coast from pollution by single use plastic, the use of plastic confetti is prohibited.
D12.	The event manager / decorator must arrange for generator power supply for all the light, sound, stage requirements. The hotel reserves the right to stop the event manager from connecting any equipment to the hotel’s power supply as the hotel infrastructure is not designed to handle the same.
D13.	The use of fireworks indoors or any kind of fire shows inside the hotel premises is strictly prohibited.
D14.	The event manager / decorator shall be permitted to set up only 24 hours prior to guest check in, subject to payment of security deposit. For earlier access, entry will be subject to availability. For guaranteed access, venue rentals shall be payable.
D15.	All equipment and set-up must be dismantled and cleared from the hotel premises within 24 hours of the event end time.
D16.	No live animals will be allowed in the hotel at any time.
D17.	Hazardous substances, flammable substances, firearms, weapons of any sort are not permitted inside the hotel premises.
D18.	No permanent alterations are allowed, including nails or hooks in the walls, roof or frames. Any damage to the hotel including linen wear and tear will be charged accordingly. The guests shall not be entitled to paint, affix or attach any matter to the walls of the function room.

MOST IMPORTANT TERMS - LIMITS ON HOTEL’S LIABILITIES
D19.	The hotel will not be responsible for any kind of damage, loss or theft of valuables. Please use the safety lockers provided in the rooms.
D20.	The hotel does not guarantee the safety of children. Guests must ensure the safety of their children, especially around the pool, elevators, stairways, terrace, glass railings, reflection pool, parking area, etc.
D21.	The hotel, its employees will not be held liable for any loss of/or damage to guests’ property while utilising this facility, any personal injury sustained, harm caused in whatever manner, or death caused due to personal injuries by negligence of guest’s. Minor children remain the responsibility of the parents/ guardians and must at all times be accompanied by a responsible adult whilst using the hotel/ pool deck and other facilities.
D22.	Force majeure: In the event of any disaster/ Act of God / major breakdowns in the hotel due to unforeseen circumstances, and the inability of the hotel to conduct the event, the hotel management reserves the right to amend/ cancel the booking. On cancellations of booking by the Hotel, the guest/  booker/ organizer will be refunded the advance paid within 7  working days without any interest. The hotel shall not be liable for making alternative arrangements, nor shall the hotel be liable to compensate the guest/ booker/ organizer for any losses financial or otherwise.
D23.	Proof of Identity with address (issued by the Government of India) of every guest is required upon check-in as per government regulations. For foreign nationals, a passport with a valid visa is required; failing to submit the copy of the id proof, the hotel has the right to deny the check-in on arrival. 
D24.	Children under the age of 18 may be accommodated only with the consent of their parents.
D25.	All government policies/ regulations prevalent during the time of the conference/ event shall apply.
D26.	All disputes will be subject to the jurisdiction as per the laws prevalent in Odisha at the time of signing the contract.`;

    setTerms(dynamicTemplate);
    if (totalAmount) {
      setTotalValue(totalAmount);
    }
    toast.success('Template populated with booking details!');
  };

  const { data: existingContract, isLoading: fetchingContract } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get(`/api/crm/contracts/${id}`);
      return res.data.contract;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingContract) {
      setTerms(existingContract.terms || '');
      setFlow(existingContract.flow || 'hotel_proposes');
      if (existingContract.payment_deadline) {
         setPaymentDeadline(existingContract.payment_deadline.split('T')[0]);
      }
      if (existingContract.expires_on) {
         setExpiresOn(existingContract.expires_on.split('T')[0]);
      }
      setTotalValue(Number(existingContract.total_value) || 0);
      setStatus(existingContract.status || 'draft');
      if (existingContract.policies) {
        setPolicies(existingContract.policies);
      }
    }

  }, [existingContract]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing) {
        const res = await apiClient.post(`/api/crm/contracts/${id}/revise`, { snapshot: payload });
        await apiClient.patch(`/api/crm/contracts/${id}`, payload);
        return res.data;
      } else {
        const res = await apiClient.post('/api/crm/contracts', payload);
        return res.data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Contract updated' : 'Contract formally drafted');
      navigate('/crm/contracts');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to sync contract');
    }
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/api/crm/contracts/${id}/send-email`, emailData);
      return res.data;
    },
    onSuccess: () => {
      addEmail(emailData.cc_email);
      addEmail(emailData.to_email);
      toast.success('Digital Contract physically dispatched!');
      setIsEmailDialogOpen(false);
      navigate('/crm/contracts');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed connecting to dispatch engine')
  });

  const handleSave = (requestedStatus = 'draft') => {
    if (!selectedPropertyId) {
      toast.error('Property selection required');
      return;
    }

    // Validation for "Sent" status
    if (requestedStatus === 'sent') {
      if (totalValue <= 0) {
        toast.error('Please enter a total value for the contract before sending.');
        return;
      }
      if (terms.length < 20 && policies.policy_list.length === 0) {
        toast.error('Please provide legal terms or add policies before recording as sent.');
        return;
      }
    }


    const payload = {
      property_id: selectedPropertyId,
      booking_id: bookingId ? parseInt(bookingId) : (existingContract?.booking_id || null),
      lead_id: leadId ? parseInt(leadId) : (existingContract?.lead_id || null),
      corporate_account_id: corporateId ? parseInt(corporateId) : (existingContract?.corporate_account_id || null),
      flow,
      terms,
      policies,
      payment_deadline: paymentDeadline || null,
      expires_on: expiresOn || null,
      total_value: totalValue,
      status: requestedStatus,
    };
    saveMutation.mutate(payload);
  };

  if (isEditing && fetchingContract) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate max-w-[200px] sm:max-w-none">
              {isEditing ? `Edit Contract ${existingContract?.contract_number}` : 'Draft Legal Contract'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Bind leads and corporate accounts digitally.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(bookingId || searchParams.get('banquet_booking_id')) && (
            <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={handleAutofill}>
              Auto-fill from Booking
            </Button>
          )}
          {isEditing && existingContract?.secure_token && (
            <>
              <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 bg-indigo-50" onClick={() => window.open(`/public/contract/${existingContract.secure_token}`, '_blank')}>
                Preview Layout
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsEmailDialogOpen(true)}>
                <Mail className="w-4 h-4 mr-1 sm:mr-2" /> 
                <span className="hidden xs:inline">Dispatch Email</span>
                <span className="xs:hidden">Dispatch</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center bg-slate-50 border-b rounded-t-xl">
              <CardTitle>Legal Stipulations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Text Block Document</Label>
                <Textarea 
                  rows={25}
                  value={terms} 
                  onChange={(e) => setTerms(e.target.value)} 
                  className="font-serif leading-relaxed"
                  placeholder="Insert clauses, refund instructions, and liabilities here..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center bg-slate-50 border-b">

              <CardTitle>Detailed Policies & Clauses</CardTitle>
              <Button size="sm" onClick={() => setIsAddingPolicy(true)} className="bg-indigo-600 text-white">
                <Plus className="w-4 h-4 mr-1" /> Add Policy
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {policies.policy_list.map((policy) => (
                <div key={policy.id} className={`p-4 rounded-xl border-2 transition-all ${COLOR_MAP[policy.color] ?? 'bg-slate-50 text-slate-700 border-slate-100'}`}>
                  {editingPolicyId === policy.id && editDraft ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          className="flex-1 h-8 text-sm font-semibold"
                          value={editDraft.title}
                          onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                          placeholder="Policy title"
                        />
                        <Select
                          value={editDraft.color}
                          onValueChange={(v) => setEditDraft({ ...editDraft, color: v as PolicyEntry['color'] })}
                        >
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLOR_OPTIONS.map((c) => (
                              <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        rows={3}
                        className="text-sm"
                        value={editDraft.content}
                        onChange={(e) => setEditDraft({ ...editDraft, content: e.target.value })}
                        placeholder="Policy content..."
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500" onClick={() => { setEditingPolicyId(null); setEditDraft(null); }}>
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                          setPolicies((prev) => ({ ...prev, policy_list: prev.policy_list.map((p) => p.id === editDraft.id ? editDraft : p) }));
                          setEditingPolicyId(null); setEditDraft(null);
                        }}>
                          <Check className="w-3 h-3 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide opacity-70">{policy.title}</p>
                        <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed">{policy.content}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          onClick={() => { setEditingPolicyId(policy.id); setEditDraft({ ...policy }); }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (window.confirm(`Delete "${policy.title}"?`)) {
                              setPolicies((prev) => ({ ...prev, policy_list: prev.policy_list.filter((p) => p.id !== policy.id) }));
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {policies.policy_list.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6 italic border-2 border-dashed border-slate-100 rounded-xl">No specific policies added yet.</p>
              )}
            </CardContent>
          </Card>

          <Dialog open={isAddingPolicy} onOpenChange={setIsAddingPolicy}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Policy</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Policy Title</Label>
                  <Input
                    value={newPolicy.title}
                    onChange={(e) => setNewPolicy({ ...newPolicy, title: e.target.value })}
                    placeholder="e.g. Cancellation Policy, Liquor Policy..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color / Category</Label>
                  <Select
                    value={newPolicy.color}
                    onValueChange={(v) => setNewPolicy({ ...newPolicy, color: v as PolicyEntry['color'] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Policy Content</Label>
                  <Textarea
                    rows={4}
                    value={newPolicy.content}
                    onChange={(e) => setNewPolicy({ ...newPolicy, content: e.target.value })}
                    placeholder="Write the policy text here..."
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setIsAddingPolicy(false)}>Cancel</Button>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => {
                      if (!newPolicy.title.trim() || !newPolicy.content.trim()) {
                        toast.error('Please fill in both title and content.');
                        return;
                      }
                      const entry: PolicyEntry = { ...newPolicy, id: `p${Date.now()}` };
                      setPolicies((prev) => ({ ...prev, policy_list: [...prev.policy_list, entry] }));
                      setIsAddingPolicy(false);
                      setNewPolicy({ title: '', content: '', color: 'slate' });
                      toast.success(`Policy "${entry.title}" added.`);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Policy
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>


        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="bg-slate-900 text-white rounded-t-xl">
              <CardTitle className="text-lg flex justify-between items-center">
                Governance
                <Badge variant="secondary" className="bg-slate-800 text-slate-100 hover:bg-slate-700">{status.toUpperCase()}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              
              <div className="space-y-2">
                 <Label className="flex items-center gap-1 text-slate-700"><LinkIcon className="w-3 h-3"/> Parent Links Attached</Label>
                 <div className="text-sm font-mono bg-slate-50 border rounded p-2">
                    {leadId || existingContract?.lead_id ? `Lead ID: ${leadId || existingContract.lead_id}` : ''}
                    {bookingId || existingContract?.booking_id ? `Booking ID: ${bookingId || existingContract.booking_id}` : ''}
                    {corporateId || existingContract?.corporate_account_id ? `Corporate ID: ${corporateId || existingContract.corporate_account_id}` : ''}
                    {!leadId && !bookingId && !corporateId && !existingContract && 'No IDs Mapped'}
                 </div>
              </div>

              <div className="space-y-2">
                <Label>Required Overarching Value (₹)</Label>
                <Input type="number" min="0" value={totalValue} onChange={(e) => setTotalValue(parseFloat(e.target.value) || 0)} />
                <p className="text-xs text-slate-400">Can be independent or matching Quotation subtotal.</p>
              </div>

              <div className="space-y-2">
                <Label>Contract Expiration (Sign by)</Label>
                <Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label>Payment Due Index</Label>
                <Input type="date" value={paymentDeadline} onChange={(e) => setPaymentDeadline(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Signature Mapping Flow</Label>
                <Select value={flow} onValueChange={setFlow}>
                   <SelectTrigger><SelectValue/></SelectTrigger>
                   <SelectContent>
                      <SelectItem value="hotel_proposes">Standard (Hotel Initiates)</SelectItem>
                      <SelectItem value="client_submits">Client Initiates (B2B)</SelectItem>
                   </SelectContent>
                </Select>
              </div>

            </CardContent>
            <CardFooter className="bg-slate-50 rounded-b-xl flex-col gap-2 p-4">
              <Button variant="outline" className="w-full bg-white" onClick={() => handleSave('draft')} disabled={saveMutation.isPending}>
                <Save className="w-4 h-4 mr-2" /> Save to Drafts
              </Button>
              <Button className="w-full bg-slate-900 hover:bg-black text-white" onClick={() => handleSave('sent')} disabled={saveMutation.isPending}>
                <Send className="w-4 h-4 mr-2" /> Record as Sent Natively
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-lg">Legal Contract Dispatch</h2>
            </div>
            <Badge className="bg-amber-500 text-white border-none">FORMAL</Badge>
          </div>
          
          <div className="p-0 bg-white">
            <div className="border-b">
              <div className="flex items-center px-6 py-3 gap-4">
                <span className="text-sm font-medium text-slate-500 w-16">To:</span>
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1"
                  value={emailData.to_email} 
                  onChange={e => setEmailData(prev => ({...prev, to_email: e.target.value}))} 
                  placeholder="client@domain.com"
                />
              </div>
            </div>
            <div className="border-b">
              <div className="flex items-center px-6 py-3 gap-4">
                <span className="text-sm font-medium text-slate-500 w-16">Cc:</span>
                <input 
                  list="cc-suggestions"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1"
                  value={emailData.cc_email} 
                  onChange={e => setEmailData(prev => ({...prev, cc_email: e.target.value}))} 
                  placeholder="legal@hotel.com"
                />
                <datalist id="cc-suggestions">
                  {recentEmails.map(email => (
                    <option key={email} value={email} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="border-b bg-slate-50/50">
              <div className="flex items-center px-6 py-3 gap-4">
                <span className="text-sm font-medium text-slate-500 w-16">Subject:</span>
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold py-1"
                  value={emailData.subject} 
                  onChange={e => setEmailData(prev => ({...prev, subject: e.target.value}))} 
                />
              </div>
            </div>
            
            <div className="px-6 py-6 space-y-4">
              <Textarea 
                rows={8}
                value={emailData.body} 
                onChange={e => setEmailData(prev => ({...prev, body: e.target.value}))} 
                className="min-h-[200px] border-none focus-visible:ring-0 resize-none p-0 text-slate-700 leading-relaxed"
                placeholder="Enter formal covering message..." 
              />
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-4 text-white">
                 <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center shrink-0 border border-slate-700">
                    <FileSignature className="w-5 h-5 text-indigo-400" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">Contract_{existingContract?.contract_number || 'Draft'}.pdf</p>
                    <p className="text-xs text-slate-400 mt-0.5">Digital Signature Portal Token Attached</p>
                 </div>
                 <Badge variant="outline" className="border-slate-700 text-slate-300">SECURE</Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 px-6 py-4 border-t gap-3">
            <Button variant="ghost" onClick={() => setIsEmailDialogOpen(false)} className="text-slate-500">
              Cancel
            </Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8" 
              onClick={() => emailMutation.mutate()} 
              disabled={emailMutation.isPending || !emailData.to_email}
            >
              {emailMutation.isPending ? 'Connecting...' : 'Dispatch Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
