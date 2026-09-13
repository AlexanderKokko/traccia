// Central hub for the 9 supported chronic conditions.
// Each condition carries its bilingual definition, alarm symptoms, dynamic diary
// fields, lifestyle guidance and educational cards.

const CONDITIONS = {
  it: {
    endometriosi: {
      key: 'endometriosi',
      label: 'Endometriosi',
      emoji: '🌙',
      color: '#B15E6C',
      definition:
        "L'endometriosi è una malattia infiammatoria cronica in cui un tessuto simile a quello che riveste l'utero (endometrio) cresce al di fuori dell'utero — su ovaie, tube o peritoneo pelvico. Può causare dolore pelvico cronico, mestruazioni molto dolorose, dolore durante i rapporti e, in alcuni casi, difficoltà a concepire.",
      alarmSymptoms: [
        'Dolore pelvico acuto e improvviso molto intenso',
        'Nausea o vomito intenso associato al dolore',
        'Febbre alta (>38,5°C)',
        'Sanguinamento vaginale abbondante e improvviso',
        'Svenimento o vertigini improvvise',
      ],
      fields: [
        {
          key: 'pain_peak',
          type: 'slider',
          label: 'Dolore peggiore oggi (picco, non media)',
          min: 0,
          max: 10,
        },
        {
          key: 'daily_impact',
          type: 'select',
          label: 'Impatto sulle attività quotidiane',
          options: [
            { value: 'nessuno', label: 'Nessuno' },
            { value: 'lieve', label: 'Lieve' },
            { value: 'moderato', label: 'Moderato — ho ridotto le attività' },
            { value: 'severo', label: 'Severo — ho dovuto fermarmi' },
          ],
        },
        {
          key: 'associated_symptoms',
          type: 'chips',
          label: 'Sintomi associati oggi',
          options: ['Dispareunia', 'Sintomi intestinali', 'Sintomi urinari', 'Dolore lombare'],
        },
        {
          key: 'pain_med_taken',
          type: 'select',
          label: 'Hai preso un farmaco al bisogno per il dolore oggi?',
          options: [
            { value: 'si', label: 'Sì' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          key: 'pain_med_name',
          type: 'text',
          label: 'Nome del farmaco',
          placeholder: 'es. Ibuprofene',
          showIf: { field: 'pain_med_taken', value: 'si' },
        },
      ],
      lifestyle: {
        helps: [
          'Alimentazione anti-infiammatoria (frutta, verdura, omega-3)',
          'Attività fisica leggere e regolare (camminata, nuoto, yoga)',
          'Curare sonno e gestione dello stress',
          'Restare ben idratata',
        ],
        avoid: [
          'Cibi ultra-processati e zuccheri raffinati',
          'Eccesso di caffeina e alcol',
          'Ignorare un dolore che peggiora progressivamente senza parlarne al medico',
        ],
      },
      contentCards: [
        {
          title: 'Il dolore non è "normale"',
          body: 'Il dolore mestruale che interfere con le attività quotidiane non va considerato "normale" o da sopportare. Se i dolori ti costringono a modificare le tue abitudini, parlane con il tuo ginecologo.',
        },
        {
          title: 'Tieni traccia dei cicli',
          body: 'Registrare regolarità, intensità del dolore e sintomi associati al ciclo aiuta il medico a inquadrare meglio la situazione. Traccia anche i giorni senza sintomi: servono a costruire un quadro completo.',
        },
      ],
    },
    ibd: {
      key: 'ibd',
      label: 'IBD',
      emoji: '🌀',
      color: '#5C7A99',
      definition: `Le malattie infiammatorie croniche intestinali (IBD) comprendono due forme principali, diverse tra loro: il Morbo di Crohn, che può colpire qualsiasi tratto dell'apparato digerente (dalla bocca all'ano) in modo discontinuo e "a tutto spessore" della parete intestinale, spesso con complicanze come fistole o stenosi; e la Colite Ulcerosa, che colpisce in modo continuo solo il colon e il retto, limitata allo strato più superficiale della mucosa, con sangue nelle feci più frequente. Entrambe condividono sintomi come dolore addominale, diarrea e stanchezza, ma localizzazione e complicanze tipiche differiscono.`,
      alarmSymptoms: [
        'Sangue abbondante nelle feci',
        'Febbre alta (>38,5°C)',
        'Dolore addominale intenso e improvviso',
        'Distensione addominale marcata',
        'Vomito persistente',
        'Battito molto veloce (>120 bpm a riposo)',
      ],
      fields: [
        {
          key: 'ibd_type',
          type: 'select',
          label: 'Tipo di IBD (opzionale)',
          options: [
            { value: 'crohn', label: 'Morbo di Crohn' },
            { value: 'colite_ulcerosa', label: 'Colite Ulcerosa' },
            { value: 'indeterminata', label: 'Colite indeterminata' },
            { value: 'non_specificato', label: 'Non specificato' },
          ],
        },
        {
          key: 'bristol_scale',
          type: 'select',
          label: 'Scala di Bristol',
          options: [
            { value: '1', label: 'Tipo 1 — sfere separate, dure' },
            { value: '2', label: 'Tipo 2 — a salsiccia, grumoso' },
            { value: '3', label: 'Tipo 3 — a salsiccia con crepe' },
            { value: '4', label: 'Tipo 4 — liscio e morbido' },
            { value: '5', label: 'Tipo 5 — pezzi morbidi' },
            { value: '6', label: 'Tipo 6 — pastoso' },
            { value: '7', label: 'Tipo 7 — liquido' },
          ],
          badge: (e) => {
            if (!e) return null
            const t = parseInt(e)
            return t <= 2
              ? { label: 'Tendenza stitichezza', level: 'moderate' }
              : t <= 4
                ? { label: 'Norma', level: 'normal' }
                : { label: 'Tendenza diarrea', level: 'moderate' }
          },
        },
        { key: 'bowel_movements', type: 'number', label: 'N. evacuazioni oggi', placeholder: '0' },
        {
          key: 'blood_present',
          type: 'select',
          label: 'Presenza di sangue',
          options: [
            { value: 'si', label: 'Sì' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          key: 'pain_location',
          type: 'select',
          label: 'Dolore addominale — zona',
          options: [
            { value: 'nessuna', label: 'Nessuna' },
            { value: 'basso_dx', label: 'Basso dx' },
            { value: 'basso_sx', label: 'Basso sx' },
            { value: 'diffuso', label: 'Diffuso' },
          ],
        },
        {
          key: 'wellbeing_yesterday',
          type: 'select',
          label: 'Benessere generale di ieri (Harvey-Bradshaw)',
          options: [
            { value: 'molto_bene', label: 'Molto bene' },
            { value: 'leggermente_sotto', label: 'Leggermente sotto tono' },
            { value: 'scarso', label: 'Scarso' },
            { value: 'molto_scarso', label: 'Molto scarso' },
            { value: 'terribile', label: 'Terribile' },
          ],
        },
        {
          key: 'pain_intensity',
          type: 'select',
          label: 'Intensità dolore addominale',
          options: [
            { value: 'nessuno', label: 'Nessuno' },
            { value: 'lieve', label: 'Lieve' },
            { value: 'moderato', label: 'Moderato' },
            { value: 'severo', label: 'Severo' },
          ],
        },
        {
          key: 'extraintestinal',
          type: 'chips',
          label: 'Manifestazioni extra-intestinali oggi',
          options: [
            'Dolore articolare',
            'Manifestazione cutanea',
            'Fastidio oculare',
            'Afte/ulcere orali',
          ],
        },
      ],
      lifestyle: {
        helps: [
          'Alimentazione mediterranea, varia, ricca di frutta e verdura',
          'Pasti piccoli e frequenti nelle fasi attive',
          'Restare ben idratata',
          'Confrontarsi con un dietista specializzato in IBD',
        ],
        avoid: [
          'Cibi ultra-processati, zuccheri aggiunti e sale in eccesso',
          'Restrizioni alimentari drastiche non guidate da un professionista',
          'Ignorare febbre, sangue abbondante o perdita di peso importante',
        ],
      },
      contentCards: [
        {
          title: "Differenza tra IBD e sindrome dell'intestino irritabile",
          body: "L'IBD è una malattia infiammatoria con riscontro di lesioni all'intestino, mentre la sindrome dell'intestino irritabile (IBS) è un disturbo funzionale senza infiammazione visibile. Pur condividendo alcuni sintomi, sono condizioni diverse che richiedono percorsi diversi.",
        },
        {
          title: 'Le riacutizzazioni e le fasi di remissione',
          body: "L'IBD ha un andamento a fasi alternate: periodi di riacutizzazione dei sintomi e periodi di remissione. Tieni traccia dei cambiamenti e segnala al medico eventuali peggioramenti prolungati.",
        },
      ],
    },
    emicrania: {
      key: 'emicrania',
      label: 'Emicrania',
      emoji: '🧠',
      color: '#7A6A9E',
      definition:
        "L'emicrania è una malattia neurologica con attacchi ricorrenti di mal di testa, spesso pulsante e da un lato solo, associato a nausea e sensibilità a luce e suoni. Ha un legame forte con la regolarità delle abitudini quotidiane.",
      alarmSymptoms: [
        'Il mal di testa peggiore mai avuto comparso improvvisamente',
        'Difficoltà a parlare o confusione improvvisa',
        'Debolezza o intorpidimento a un lato del corpo',
        'Perdita di equilibrio improvvisa',
        'Visione doppia o perdita della vista',
        'Febbre alta con rigidità del collo',
      ],
      fields: [
        {
          key: 'associated_symptoms',
          type: 'checkbox',
          label: 'Sintomi associati',
          options: ['Nausea', 'Fotofobia', 'Fonofobia'],
        },
        {
          key: 'triggers',
          type: 'chips',
          label: 'Trigger possibili oggi',
          options: ['Stress', 'Sonno alterato', 'Alimenti', 'Ciclo/ormonale', 'Schermi/luce'],
        },
        {
          key: 'impact',
          type: 'select',
          label: 'Impatto sulle attività',
          options: [
            { value: 'nessuno', label: 'Nessuno' },
            { value: 'lieve', label: 'Lieve' },
            { value: 'moderato', label: 'Moderato' },
            { value: 'severo', label: 'Severo' },
          ],
        },
        {
          key: 'medication_response',
          type: 'select',
          label: 'Farmaco sintomatico assunto?',
          options: [
            { value: 'no', label: 'No' },
            { value: 'si_funzionato', label: 'Sì — ha funzionato' },
            { value: 'si_parzialmente', label: 'Sì — parzialmente' },
            { value: 'si_non_funzionato', label: 'Sì — non ha funzionato' },
          ],
        },
      ],
      lifestyle: {
        helps: [
          'Orari regolari di sonno e pasti',
          'Restare ben idratata',
          'Attività fisica moderata e regolare',
          'Tecniche di gestione dello stress',
        ],
        avoid: [
          'Saltare i pasti (può abbassare la glicemia e scatenare un attacco)',
          'Eccesso di caffeina o interruzione brusca',
          'Fumo ed esposizione al fumo passivo',
          'Attività fisica improvvisa e troppo intensa',
        ],
      },
      contentCards: [
        {
          title: `L'emicrania non è "solo un mal di testa"`,
          body: "L'emicrania è una condizione neurologica complessa, non un semplice mal di testa. Gli attacchi possono durare da ore a giorni e includere sintomi come nausea, sensibilità alla luce e al rumore. Riconoscere i propri trigger è un passo importante.",
        },
        {
          title: 'Il diario degli attacchi',
          body: 'Registrare quando iniziano gli attacchi, la durata, i possibili trigger e la risposta ai farmaci aiuta il neurologo a personalizzare il trattamento. La regolarità delle abitudini è uno degli elementi chiave nella gestione.',
        },
      ],
    },
    diabete: {
      key: 'diabete',
      label: 'Diabete',
      emoji: '🍬',
      color: '#B8863B',
      definition:
        'Il diabete è una condizione cronica in cui il corpo non produce abbastanza insulina o non la utilizza correttamente, causando livelli di glucosio nel sangue troppo alti. Nel tempo, se non ben gestito, può danneggiare vasi sanguigni, nervi, reni e occhi.',
      alarmSymptoms: [
        'Glicemia molto bassa con confusione o quasi perdita di coscienza',
        'Glicemia molto alta con nausea/vomito persistente',
        'Respiro rapido e profondo o alito con odore fruttato',
        'Forte dolore addominale',
        'Confusione o difficoltà a restare sveglia/o',
      ],
      fields: [
        {
          key: 'glycemia',
          type: 'number',
          label: 'Glicemia (mg/dL)',
          placeholder: 'es. 110',
          badge: (e, t) => {
            if (!e) return null
            const n = t == null ? void 0 : t.measurement_moment
            let r, i
            switch (n) {
              case 'digiuno':
                ;((r = 70), (i = 130))
                break
              case 'prima_pasto':
                ;((r = 80), (i = 130))
                break
              case 'dopo_pasto':
                ;((r = 0), (i = 180))
                break
              case 'prima_dormire':
                ;((r = 90), (i = 150))
                break
              default:
                ;((r = 70), (i = 130))
            }
            return e < r
              ? { label: 'Basso', level: 'low' }
              : e > i
                ? { label: 'Alto', level: 'high' }
                : { label: 'Nel range', level: 'normal' }
          },
        },
        {
          key: 'measurement_moment',
          type: 'select',
          label: 'Momento della misurazione',
          options: [
            { value: 'digiuno', label: 'Digiuno' },
            { value: 'prima_pasto', label: 'Prima pasto' },
            { value: 'dopo_pasto', label: 'Dopo pasto (2h)' },
            { value: 'prima_dormire', label: 'Prima di dormire' },
          ],
        },
        {
          key: 'symptoms',
          type: 'chips',
          label: 'Sintomi oggi',
          options: ['Sintomi di ipoglicemia', 'Sintomi di iperglicemia'],
        },
        {
          key: 'medication',
          type: 'select',
          label: 'Farmaco/insulina assunto come da terapia?',
          options: [
            { value: 'si', label: 'Sì' },
            { value: 'no', label: 'No' },
            { value: 'parzialmente', label: 'Parzialmente' },
          ],
        },
        {
          key: 'exercise_minutes',
          type: 'number',
          label: 'Attività fisica minuti oggi',
          placeholder: '0',
        },
      ],
      lifestyle: {
        helps: [
          'Pasti regolari e bilanciati, senza saltarli',
          'Attività fisica regolare',
          'Monitorare la glicemia come indicato dal medico',
          'Assumere la terapia come prescritta',
        ],
        avoid: [
          'Saltare i pasti o digiuni prolungati non concordati',
          'Bevande zuccherate e cibi ultra-processati',
          'Ignorare sintomi di ipoglicemia (tremore, sudorazione, confusione)',
        ],
      },
      contentCards: [
        {
          title: 'I valori di riferimento della glicemia',
          body: "I range mostrati nell'app (es. digiuno 70-130 mg/dL) sono basati sulle linee guida ADA e servono come riferimento. Il tuo target personale può differire: il diabetologo stabilisce gli obiettivi più adatti a te.",
        },
        {
          title: "Riconoscere l'ipoglicemia",
          body: "Tremore, sudorazione, palpitazioni, fame improvvisa e confusione possono segnalare un calo di zuccheri. Avere sempre con sé zuccheri rapidi (es. succo di frutta) e registrare l'episodio aiuta a prevenire future situazioni a rischio.",
        },
      ],
    },
    pcos: {
      key: 'pcos',
      label: 'PCOS',
      emoji: '🌸',
      color: '#3E8E82',
      definition:
        "La sindrome dell'ovaio policistico (PCOS) è una condizione endocrina comune caratterizzata da cicli mestruali irregolari o assenti, segni di eccesso di androgeni (come acne o crescita di peli in eccesso) e, spesso, resistenza all'insulina. È una delle cause più frequenti di infertilità legata all'ovulazione.",
      alarmSymptoms: [
        'Dolore pelvico acuto e improvviso molto intenso',
        'Nausea o vomito intenso associato al dolore',
        'Febbre alta',
        'Svenimento o vertigini improvvise',
        'Sanguinamento vaginale abbondante e anomalo',
      ],
      fields: [
        {
          key: 'cycle_day',
          type: 'number',
          label: 'Giorno del ciclo (opzionale)',
          placeholder: 'es. 14',
        },
        {
          key: 'cycle_length',
          type: 'number',
          label: "Lunghezza dell'ultimo ciclo (giorni)",
          placeholder: 'es. 28',
          badge: (e) =>
            e
              ? e < 21
                ? { label: 'Ciclo breve', level: 'moderate' }
                : e <= 35
                  ? { label: 'Norma (21-35)', level: 'normal' }
                  : { label: 'Ciclo lungo', level: 'moderate' }
              : null,
        },
        {
          key: 'androgen_symptoms',
          type: 'chips',
          label: 'Sintomi androgenici oggi',
          options: ['Acne', 'Crescita pelo viso/corpo', 'Diradamento capelli'],
        },
        {
          key: 'sugar_cravings',
          type: 'select',
          label: 'Voglie di zuccheri/carboidrati oggi',
          options: [
            { value: 'nessuna', label: 'Nessuna' },
            { value: 'lievi', label: 'Lievi' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'intense', label: 'Intense' },
          ],
        },
        {
          key: 'weight',
          type: 'number',
          label: 'Peso (kg, opzionale)',
          placeholder: 'es. 65',
          unit: 'kg',
        },
      ],
      lifestyle: {
        helps: [
          'Alimentazione a basso indice glicemico, ricca di fibre',
          'Attività fisica regolare (aiuta la sensibilità insulinica)',
          'Monitorare regolarità e lunghezza del ciclo',
          'Curare il sonno e la gestione dello stress',
        ],
        avoid: [
          'Cibi ultra-processati e zuccheri raffinati',
          'Digiuni prolungati e diete drastiche',
          'Ignorare cicli assenti per molti mesi consecutivi senza parlarne al medico',
        ],
      },
      contentCards: [
        {
          title: 'Criteri di Rotterdam',
          body: "La diagnosi di PCOS si basa sui criteri di Rotterdam: almeno 2 su 3 tra cicli irregolari/anovulazione, segni di eccesso androgeno e ovaie policistiche all'ecografia. Solo il medico può fare la diagnosi: l'app ti aiuta a tenere traccia dei dati.",
        },
        {
          title: "Resistenza all'insulina e stile di vita",
          body: "Molte persone con PCOS hanno resistenza all'insulina. L'attività fisica regolare e un'alimentazione a basso indice glicemico possono migliorare la sensibilità insulinica e la regolarità del ciclo.",
        },
      ],
    },
    ipertiroidismo: {
      key: 'ipertiroidismo',
      label: 'Ipertiroidismo',
      emoji: '⚡',
      color: '#C9694F',
      definition:
        "L'ipertiroidismo è una condizione in cui la tiroide produce un eccesso di ormoni tiroidei, accelerando il metabolismo del corpo. Può causare battito cardiaco accelerato o irregolare, perdita di peso involontaria, tremore, sudorazione eccessiva, ansia e insonnia. La causa più comune è il morbo di Graves.",
      alarmSymptoms: [
        'Dolore al petto',
        'Svenimento',
        'Difficoltà respiratoria',
        'Battito molto veloce (>120 bpm a riposo)',
        'Battito molto lento (<45 bpm)',
        'Confusione improvvisa',
        'Febbre alta (>38,5°C)',
      ],
      fields: [
        {
          key: 'heart_rate',
          type: 'number',
          label: 'Frequenza cardiaca a riposo (bpm, opzionale)',
          placeholder: 'es. 80',
          badge: (e) =>
            e
              ? e < 45
                ? { label: 'Molto basso', level: 'high' }
                : e < 60
                  ? { label: 'Basso', level: 'low' }
                  : e <= 100
                    ? { label: 'Normale', level: 'normal' }
                    : e <= 120
                      ? { label: 'Alto', level: 'moderate' }
                      : { label: 'Molto alto', level: 'high' }
              : null,
        },
        {
          key: 'weight',
          type: 'number',
          label: 'Peso (kg, opzionale)',
          placeholder: 'es. 65',
          unit: 'kg',
        },
        {
          key: 'symptoms',
          type: 'chips',
          label: 'Sintomi oggi',
          options: [
            'Palpitazioni',
            'Tremore',
            'Sudorazione eccessiva',
            'Insonnia',
            'Irritabilità/ansia',
          ],
        },
      ],
      lifestyle: {
        helps: [
          'Assumere la terapia esattamente come prescritta e agli orari indicati',
          'Monitorare frequenza cardiaca e peso',
          'Limitare la caffeina',
          "Riposo adeguato nonostante l'iperattività percepita",
        ],
        avoid: [
          'Sospendere o modificare la terapia senza parlarne al medico',
          'Eccesso di iodio senza supervisione medica',
          'Ignorare palpitazioni persistenti o perdita di peso rapida e importante',
        ],
      },
      contentCards: [
        {
          title: 'Il morbo di Graves',
          body: 'La causa più comune di ipertiroidismo è il morbo di Graves, una malattia autoimmune in cui il sistema immunitario stimola la tiroide a produrre troppi ormoni. Esistono anche altre cause: il medico stabilirà quella specifica del tuo caso.',
        },
        {
          title: 'Monitorare battito e peso',
          body: "Registrare regolarmente la frequenza cardiaca a riposo e il peso aiuta a seguire l'andamento nel tempo. Variazioni rapide e importanti vanno segnalate tempestivamente al medico.",
        },
      ],
    },
    ipotiroidismo: {
      key: 'ipotiroidismo',
      label: 'Ipotiroidismo',
      emoji: '🐢',
      color: '#5A5FA6',
      definition:
        "L'ipotiroidismo è una condizione in cui la tiroide non produce abbastanza ormoni tiroidei, rallentando il metabolismo del corpo. Può causare stanchezza persistente, aumento di peso, intolleranza al freddo, stipsi, pelle secca, caduta di capelli e difficoltà di concentrazione. La causa più comune è la tiroidite di Hashimoto.",
      alarmSymptoms: [
        'Dolore al petto',
        'Svenimento',
        'Difficoltà respiratoria',
        'Battito molto veloce (>120 bpm a riposo)',
        'Battito molto lento (<45 bpm)',
        'Confusione improvvisa',
        'Febbre alta (>38,5°C)',
      ],
      fields: [
        { key: 'fatigue', type: 'slider', label: 'Livello di stanchezza', min: 0, max: 10 },
        {
          key: 'weight',
          type: 'number',
          label: 'Peso (kg, opzionale)',
          placeholder: 'es. 65',
          unit: 'kg',
        },
        {
          key: 'symptoms',
          type: 'chips',
          label: 'Sintomi oggi',
          options: [
            'Intolleranza al freddo',
            'Stipsi',
            'Pelle secca/caduta capelli',
            'Difficoltà di concentrazione',
            'Umore basso',
          ],
        },
        {
          key: 'daytime_sleepiness',
          type: 'select',
          label: 'Sonnolenza durante il giorno?',
          options: [
            { value: 'si', label: 'Sì' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          key: 'mood_today',
          type: 'select',
          label: 'Come descriveresti il tuo umore oggi?',
          options: [
            { value: 'ottimo', label: 'Ottimo' },
            { value: 'buono', label: 'Buono' },
            { value: 'normale', label: 'Normale' },
            { value: 'triste', label: 'Triste' },
            { value: 'molto_depresso', label: 'Molto depresso' },
          ],
        },
        {
          key: 'bp_systolic',
          type: 'number',
          label: 'Pressione sistolica (mmHg, opzionale)',
          placeholder: 'es. 120',
        },
        {
          key: 'bp_diastolic',
          type: 'number',
          label: 'Pressione diastolica (mmHg, opzionale)',
          placeholder: 'es. 80',
          badge: (e, t) => {
            if (!e || !(t != null && t.bp_systolic)) return null
            const n = t.bp_systolic
            return n >= 140 || e >= 90
              ? { label: 'Elevata', level: 'high' }
              : n >= 130 || e >= 80
                ? { label: 'Sopra la norma', level: 'moderate' }
                : { label: 'Normale', level: 'normal' }
          },
        },
        {
          key: 'body_temp',
          type: 'number',
          label: 'Temperatura corporea (°C, opzionale)',
          placeholder: 'es. 36.5',
          badge: (e) =>
            e
              ? e < 36.1
                ? { label: 'Bassa', level: 'low' }
                : e <= 37.2
                  ? { label: 'Normale', level: 'normal' }
                  : e <= 38
                    ? { label: 'Febbricola', level: 'moderate' }
                    : { label: 'Febbre', level: 'high' }
              : null,
        },
        {
          key: 'thyroid_intensity',
          type: 'slider',
          label: 'Quanto sono stati intensi oggi i sintomi della tiroide?',
          min: 1,
          max: 10,
        },
      ],
      lifestyle: {
        helps: [
          'Assumere la levotiroxina a digiuno, sempre alla stessa ora, come prescritta',
          'Attendere almeno 30-60 minuti prima di mangiare o assumere altri farmaci/integratori',
          'Attività fisica regolare e leggera',
          'Alimentazione equilibrata con adeguato apporto di fibre',
        ],
        avoid: [
          "Assumere la levotiroxina insieme a calcio, ferro o caffè (ne riducono l'assorbimento)",
          'Sospendere la terapia perché "ci si sente meglio"',
          'Ignorare stanchezza estrema e persistente pensando sia solo stress',
        ],
      },
      contentCards: [
        {
          title: 'La tiroidite di Hashimoto',
          body: 'La causa più comune di ipotiroidismo è la tiroidite di Hashimoto, una malattia autoimmune in cui il sistema immunitario attacca la tiroide riducendone la funzione. È diagnosticata tramite esami del sangue (TSH, FT4, anticorpi anti-TPO).',
        },
        {
          title: "Levotiroxina: l'assorbimento conta",
          body: "La levotiroxina va assunta a digiono, preferibilmente al mattino, aspettando 30-60 minuti prima di mangiare o assumere altri farmaci/integratori (soprattutto calcio e ferro, che ne riducono l'assorbimento). La costanza negli orari migliora la stabilità dei valori.",
        },
      ],
    },
    fibromialgia: {
      key: 'fibromialgia',
      label: 'Fibromialgia',
      emoji: '🌫️',
      color: '#9B6B8C',
      definition:
        'La fibromialgia è una malattia cronica caratterizzata da dolore muscoloscheletrico diffuso, presente da almeno tre mesi, spesso accompagnato da rigidità, sonno non ristoratore, stanchezza cronica e difficoltà di concentrazione (la cosiddetta "nebbia mentale"). Colpisce prevalentemente le donne, con un picco tra i 40 e i 60 anni.',
      alarmSymptoms: [
        'Dolore al petto',
        'Debolezza improvvisa e severa a un lato del corpo',
        'Febbre alta (>38,5°C)',
        'Gonfiore intenso e improvviso di una singola articolazione',
        'Perdita di peso importante e non spiegata',
      ],
      fields: [
        {
          key: 'pain_areas',
          type: 'chips',
          label: 'Aree del corpo dolenti oggi (WPI)',
          options: [
            'Braccia',
            'Gambe',
            'Schiena',
            'Collo e spalle',
            'Torace',
            'Addome',
            'Testa e viso',
          ],
        },
        {
          key: 'restful_sleep',
          type: 'select',
          label: 'Sonno ristoratore stanotte?',
          options: [
            { value: 'si', label: 'Sì' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          key: 'brain_fog',
          type: 'select',
          label: 'Nebbia mentale oggi',
          options: [
            { value: 'nessuna', label: 'Nessuna' },
            { value: 'lieve', label: 'Lieve' },
            { value: 'moderata', label: 'Moderata' },
            { value: 'intensa', label: 'Intensa' },
          ],
        },
        {
          key: 'morning_stiffness_min',
          type: 'number',
          label: 'Rigidità mattutina (minuti, opzionale)',
          placeholder: 'es. 30',
          unit: 'min',
        },
        { key: 'fatigue', type: 'slider', label: 'Livello di stanchezza', min: 0, max: 10 },
        {
          key: 'triggers',
          type: 'chips',
          label: 'Possibili trigger oggi',
          options: ['Stress', 'Variazioni meteo', 'Sforzo fisico', 'Sonno alterato'],
        },
      ],
      trendField: { key: 'fatigue', label: 'Livello di stanchezza' },
      lifestyle: {
        helps: [
          'Attività fisica leggera e graduale (stretching, nuoto, cammino)',
          'Tecniche di gestione dello stress e rilassamento',
          'Orari di sonno regolari',
          'Ritmare le attività alternando sforzo e riposo',
        ],
        avoid: [
          'Sforzi fisici intensi e improvvisi',
          'Lunghi periodi di inattività totale',
          'Ignorare un peggioramento marcato pensando sia "solo stanchezza"',
        ],
      },
      contentCards: [
        {
          title: 'Non è "tutto nella tua testa"',
          body: "La fibromialgia è una condizione reale e riconosciuta, caratterizzata da una maggiore sensibilità al dolore. Non è un'invenzione e il dolore che avverti è reale. Una diagnosi chiara aiuta a intraprendere il percorso più adatto.",
        },
        {
          title: 'Ritmo e gradualità',
          body: "L'attività fisica leggera e regolare, il sonno coerente e la gestione dello stress sono tra gli elementi più efficaci. L'obiettivo non è l'intensità, ma la costanza: piccoli passi ripetuti nel tempo.",
        },
      ],
    },
    artrite_reumatoide: {
      key: 'artrite_reumatoide',
      label: 'Artrite Reumatoide',
      emoji: '🦴',
      color: '#8C7355',
      definition:
        "L'artrite reumatoide è una malattia infiammatoria autoimmune cronica che provoca dolore, gonfiore, rigidità e progressiva perdita di funzione delle articolazioni. Colpisce più frequentemente le piccole articolazioni di mani, polsi e piedi, in modo simmetrico. È diversa dall'artrosi (osteoartrosi), che è un processo degenerativo legato all'usura delle articolazioni, non su base autoimmune.",
      alarmSymptoms: [
        "Febbre alta con un'articolazione molto calda, gonfia e dolorante (possibile artrite settica)",
        'Dolore al petto o difficoltà respiratoria',
        'Arrossamento e dolore oculare intenso',
        'Intorpidimento o debolezza improvvisa',
        'Gonfiore severo e improvviso di più articolazioni con malessere generale',
      ],
      fields: [
        {
          key: 'morning_stiffness_min',
          type: 'number',
          label: 'Rigidità mattutina (minuti)',
          placeholder: 'es. 45',
          unit: 'min',
        },
        {
          key: 'joint_swelling',
          type: 'select',
          label: 'Gonfiore articolare oggi?',
          options: [
            { value: 'si', label: 'Sì' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          key: 'affected_joints',
          type: 'chips',
          label: 'Articolazioni coinvolte oggi',
          options: [
            'Mani e polsi',
            'Gomiti',
            'Spalle',
            'Ginocchia',
            'Caviglie e piedi',
            'Colonna cervicale',
          ],
        },
        {
          key: 'daily_impact',
          type: 'select',
          label: 'Impatto sulle attività quotidiane',
          options: [
            { value: 'nessuno', label: 'Nessuno' },
            { value: 'lieve', label: 'Lieve' },
            { value: 'moderato', label: 'Moderato — ho ridotto le attività' },
            { value: 'severo', label: 'Severo — ho dovuto fermarmi' },
          ],
        },
      ],
      trendField: { key: 'morning_stiffness_min', label: 'Rigidità mattutina (min)' },
      lifestyle: {
        helps: [
          'Assumere la terapia regolarmente, anche nei periodi senza sintomi',
          'Attività fisica a basso impatto per mantenere la mobilità articolare',
          'Applicare calore o freddo sulle articolazioni doloranti secondo le indicazioni del medico',
          'Proteggere le articolazioni nei gesti quotidiani',
        ],
        avoid: [
          'Interrompere la terapia perché "ci si sente meglio"',
          'Sforzi articolari ripetuti e prolungati durante una riacutizzazione',
          'Ignorare una singola articolazione molto calda e gonfia, specialmente con febbre',
        ],
      },
      contentCards: [
        {
          title: 'Artrite reumatoide e artrosi non sono la stessa cosa',
          body: "L'artrite reumatoide è una malattia autoimmune: il sistema immunitario attacca le articolazioni causando infiammazione. L'artrosi, invece, è un processo degenerativo legato all'usura della cartilagine. Hanno cause, trattamenti e prognosi diversi da chiarire con il reumatologo.",
        },
        {
          title: 'La rigidità mattutina è un segnale importante',
          body: "La rigidità al risveglio, e quanto tempo ci vuole per migliorare, è un indicatore che aiuta il reumatologo a capire l'attività della malattia. Registrare i minuti di durata ogni giorno aiuta a costruire un quadro utile per le visite.",
        },
      ],
    },
  },
  en: {
    endometriosi: {
      key: 'endometriosi',
      label: 'Endometriosis',
      emoji: '🌙',
      color: '#B15E6C',
      definition:
        'Endometriosis is a chronic inflammatory disease in which tissue similar to the lining of the uterus (endometrium) grows outside the uterus — on the ovaries, fallopian tubes, or pelvic peritoneum. It can cause chronic pelvic pain, very painful periods, pain during intercourse, and, in some cases, difficulty conceiving.',
      alarmSymptoms: [
        'Sudden, very intense acute pelvic pain',
        'Severe nausea or vomiting associated with the pain',
        'High fever (>38.5°C)',
        'Sudden heavy vaginal bleeding',
        'Sudden fainting or dizziness',
      ],
      fields: [
        {
          key: 'pain_peak',
          type: 'slider',
          label: 'Worst pain today (peak, not average)',
          min: 0,
          max: 10,
        },
        {
          key: 'daily_impact',
          type: 'select',
          label: 'Impact on daily activities',
          options: [
            { value: 'nessuno', label: 'None' },
            { value: 'lieve', label: 'Mild' },
            { value: 'moderato', label: 'Moderate — I reduced activities' },
            { value: 'severo', label: 'Severe — I had to stop' },
          ],
        },
        {
          key: 'associated_symptoms',
          type: 'chips',
          label: 'Associated symptoms today',
          options: ['Dyspareunia', 'Bowel symptoms', 'Urinary symptoms', 'Lower back pain'],
        },
        {
          key: 'pain_med_taken',
          type: 'select',
          label: 'Did you take an as-needed pain medication today?',
          options: [
            { value: 'si', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          key: 'pain_med_name',
          type: 'text',
          label: 'Medication name',
          placeholder: 'e.g. Ibuprofen',
          showIf: { field: 'pain_med_taken', value: 'si' },
        },
      ],
      lifestyle: {
        helps: [
          'Anti-inflammatory diet (fruit, vegetables, omega-3)',
          'Light, regular physical activity (walking, swimming, yoga)',
          'Good sleep and stress management',
          'Staying well hydrated',
        ],
        avoid: [
          'Ultra-processed foods and refined sugars',
          'Excess caffeine and alcohol',
          'Ignoring progressively worsening pain without talking to your doctor',
        ],
      },
      contentCards: [
        {
          title: 'Pain is not "normal"',
          body: 'Menstrual pain that interferes with daily activities should not be considered "normal" or something to endure. If pain forces you to change your habits, talk to your gynecologist.',
        },
        {
          title: 'Track your cycles',
          body: 'Recording cycle regularity, pain intensity, and associated symptoms helps your doctor better assess your situation. Track symptom-free days too — they help build a complete picture.',
        },
      ],
    },
    ibd: {
      key: 'ibd',
      label: 'IBD',
      emoji: '🌀',
      color: '#5C7A99',
      definition: `Inflammatory bowel disease (IBD) includes two main, distinct forms: Crohn's disease, which can affect any part of the digestive tract (from mouth to anus) in a patchy, "full-thickness" pattern through the intestinal wall, often with complications like fistulas or strictures; and Ulcerative Colitis, which continuously affects only the colon and rectum, limited to the innermost lining, with blood in the stool more frequently. Both share symptoms like abdominal pain, diarrhea, and fatigue, but their typical location and complications differ.`,
      alarmSymptoms: [
        'Heavy blood in stool',
        'High fever (>38.5°C)',
        'Sudden, intense abdominal pain',
        'Marked abdominal distension',
        'Persistent vomiting',
        'Very fast heart rate (>120 bpm at rest)',
      ],
      fields: [
        {
          key: 'ibd_type',
          type: 'select',
          label: 'Type of IBD (optional)',
          options: [
            { value: 'crohn', label: "Crohn's disease" },
            { value: 'colite_ulcerosa', label: 'Ulcerative Colitis' },
            { value: 'indeterminata', label: 'Indeterminate colitis' },
            { value: 'non_specificato', label: 'Not specified' },
          ],
        },
        {
          key: 'bristol_scale',
          type: 'select',
          label: 'Bristol stool scale',
          options: [
            { value: '1', label: 'Type 1 — separate hard lumps' },
            { value: '2', label: 'Type 2 — sausage-shaped, lumpy' },
            { value: '3', label: 'Type 3 — sausage with cracks' },
            { value: '4', label: 'Type 4 — smooth and soft' },
            { value: '5', label: 'Type 5 — soft blobs' },
            { value: '6', label: 'Type 6 — mushy' },
            { value: '7', label: 'Type 7 — liquid' },
          ],
          badge: (e) => {
            if (!e) return null
            const t = parseInt(e)
            return t <= 2
              ? { label: 'Constipation tendency', level: 'moderate' }
              : t <= 4
                ? { label: 'Normal', level: 'normal' }
                : { label: 'Diarrhea tendency', level: 'moderate' }
          },
        },
        {
          key: 'bowel_movements',
          type: 'number',
          label: 'Number of bowel movements today',
          placeholder: '0',
        },
        {
          key: 'blood_present',
          type: 'select',
          label: 'Blood present',
          options: [
            { value: 'si', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          key: 'pain_location',
          type: 'select',
          label: 'Abdominal pain — location',
          options: [
            { value: 'nessuna', label: 'None' },
            { value: 'basso_dx', label: 'Lower right' },
            { value: 'basso_sx', label: 'Lower left' },
            { value: 'diffuso', label: 'Diffuse' },
          ],
        },
        {
          key: 'wellbeing_yesterday',
          type: 'select',
          label: "Yesterday's general wellbeing (Harvey-Bradshaw)",
          options: [
            { value: 'molto_bene', label: 'Very well' },
            { value: 'leggermente_sotto', label: 'Slightly off' },
            { value: 'scarso', label: 'Poor' },
            { value: 'molto_scarso', label: 'Very poor' },
            { value: 'terribile', label: 'Terrible' },
          ],
        },
        {
          key: 'pain_intensity',
          type: 'select',
          label: 'Abdominal pain intensity',
          options: [
            { value: 'nessuno', label: 'None' },
            { value: 'lieve', label: 'Mild' },
            { value: 'moderato', label: 'Moderate' },
            { value: 'severo', label: 'Severe' },
          ],
        },
        {
          key: 'extraintestinal',
          type: 'chips',
          label: 'Extra-intestinal manifestations today',
          options: ['Joint pain', 'Skin manifestation', 'Eye discomfort', 'Mouth sores/ulcers'],
        },
      ],
      lifestyle: {
        helps: [
          'Varied Mediterranean diet, rich in fruit and vegetables',
          'Small, frequent meals during flares',
          'Staying well hydrated',
          'Consulting a dietitian specialized in IBD',
        ],
        avoid: [
          'Ultra-processed foods, added sugars, and excess salt',
          'Drastic dietary restrictions not guided by a professional',
          'Ignoring fever, heavy blood, or significant weight loss',
        ],
      },
      contentCards: [
        {
          title: 'Difference between IBD and irritable bowel syndrome',
          body: 'IBD is an inflammatory disease with visible intestinal damage, while irritable bowel syndrome (IBS) is a functional disorder without visible inflammation. While sharing some symptoms, they are different conditions requiring different approaches.',
        },
        {
          title: 'Flares and remission phases',
          body: 'IBD follows an alternating pattern: flare-ups and remission periods. Track changes and report any prolonged worsening to your doctor.',
        },
      ],
    },
    emicrania: {
      key: 'emicrania',
      label: 'Migraine',
      emoji: '🧠',
      color: '#7A6A9E',
      definition:
        'Migraine is a neurological disease with recurring headache attacks, often throbbing and one-sided, associated with nausea and sensitivity to light and sound. It has a strong link to the regularity of daily habits.',
      alarmSymptoms: [
        'The worst headache ever, appearing suddenly',
        'Sudden difficulty speaking or confusion',
        'Weakness or numbness on one side of the body',
        'Sudden loss of balance',
        'Double vision or vision loss',
        'High fever with neck stiffness',
      ],
      fields: [
        {
          key: 'associated_symptoms',
          type: 'checkbox',
          label: 'Associated symptoms',
          options: ['Nausea', 'Photophobia', 'Phonophobia'],
        },
        {
          key: 'triggers',
          type: 'chips',
          label: 'Possible triggers today',
          options: ['Stress', 'Altered sleep', 'Food', 'Cycle/hormonal', 'Screens/light'],
        },
        {
          key: 'impact',
          type: 'select',
          label: 'Impact on activities',
          options: [
            { value: 'nessuno', label: 'None' },
            { value: 'lieve', label: 'Mild' },
            { value: 'moderato', label: 'Moderate' },
            { value: 'severo', label: 'Severe' },
          ],
        },
        {
          key: 'medication_response',
          type: 'select',
          label: 'Symptomatic medication taken?',
          options: [
            { value: 'no', label: 'No' },
            { value: 'si_funzionato', label: 'Yes — it worked' },
            { value: 'si_parzialmente', label: 'Yes — partially' },
            { value: 'si_non_funzionato', label: "Yes — didn't work" },
          ],
        },
      ],
      lifestyle: {
        helps: [
          'Regular sleep and meal times',
          'Staying well hydrated',
          'Moderate, regular physical activity',
          'Stress management techniques',
        ],
        avoid: [
          'Skipping meals (can lower blood sugar and trigger an attack)',
          'Excess caffeine or abrupt withdrawal',
          'Smoking and secondhand smoke exposure',
          'Sudden, overly intense physical activity',
        ],
      },
      contentCards: [
        {
          title: 'Migraine is not "just a headache"',
          body: 'Migraine is a complex neurological condition, not a simple headache. Attacks can last from hours to days and include symptoms like nausea and sensitivity to light and noise. Recognizing your own triggers is an important step.',
        },
        {
          title: 'The attack diary',
          body: 'Recording when attacks start, their duration, possible triggers, and response to medication helps your neurologist personalize treatment. Regular habits are a key element in management.',
        },
      ],
    },
    diabete: {
      key: 'diabete',
      label: 'Diabetes',
      emoji: '🍬',
      color: '#B8863B',
      definition:
        "Diabetes is a chronic condition in which the body doesn't produce enough insulin or doesn't use it properly, causing blood glucose levels to be too high. Over time, if not well managed, it can damage blood vessels, nerves, kidneys, and eyes.",
      alarmSymptoms: [
        'Very low blood sugar with confusion or near loss of consciousness',
        'Very high blood sugar with persistent nausea/vomiting',
        'Rapid, deep breathing or fruity-smelling breath',
        'Severe abdominal pain',
        'Confusion or difficulty staying awake',
      ],
      fields: [
        {
          key: 'glycemia',
          type: 'number',
          label: 'Blood glucose (mg/dL)',
          placeholder: 'e.g. 110',
          badge: (e, t) => {
            if (!e) return null
            const n = t == null ? void 0 : t.measurement_moment
            let r, i
            switch (n) {
              case 'digiuno':
                ;((r = 70), (i = 130))
                break
              case 'prima_pasto':
                ;((r = 80), (i = 130))
                break
              case 'dopo_pasto':
                ;((r = 0), (i = 180))
                break
              case 'prima_dormire':
                ;((r = 90), (i = 150))
                break
              default:
                ;((r = 70), (i = 130))
            }
            return e < r
              ? { label: 'Low', level: 'low' }
              : e > i
                ? { label: 'High', level: 'high' }
                : { label: 'In range', level: 'normal' }
          },
        },
        {
          key: 'measurement_moment',
          type: 'select',
          label: 'Measurement moment',
          options: [
            { value: 'digiuno', label: 'Fasting' },
            { value: 'prima_pasto', label: 'Before meal' },
            { value: 'dopo_pasto', label: 'After meal (2h)' },
            { value: 'prima_dormire', label: 'Before sleep' },
          ],
        },
        {
          key: 'symptoms',
          type: 'chips',
          label: 'Symptoms today',
          options: ['Hypoglycemia symptoms', 'Hyperglycemia symptoms'],
        },
        {
          key: 'medication',
          type: 'select',
          label: 'Medication/insulin taken as prescribed?',
          options: [
            { value: 'si', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'parzialmente', label: 'Partially' },
          ],
        },
        {
          key: 'exercise_minutes',
          type: 'number',
          label: 'Exercise minutes today',
          placeholder: '0',
        },
      ],
      lifestyle: {
        helps: [
          'Regular, balanced meals, not skipped',
          'Regular physical activity',
          'Monitoring blood glucose as directed by your doctor',
          'Taking therapy as prescribed',
        ],
        avoid: [
          'Skipping meals or unplanned prolonged fasting',
          'Sugary drinks and ultra-processed foods',
          'Ignoring hypoglycemia symptoms (shaking, sweating, confusion)',
        ],
      },
      contentCards: [
        {
          title: 'Blood glucose reference values',
          body: 'The ranges shown in the app (e.g. fasting 70-130 mg/dL) are based on ADA guidelines and serve as a reference. Your personal target may differ — your diabetologist sets the goals best suited to you.',
        },
        {
          title: 'Recognizing hypoglycemia',
          body: 'Shaking, sweating, palpitations, sudden hunger, and confusion can signal low blood sugar. Always carrying fast-acting sugar (e.g. fruit juice) and logging the episode helps prevent future risky situations.',
        },
      ],
    },
    pcos: {
      key: 'pcos',
      label: 'PCOS',
      emoji: '🌸',
      color: '#3E8E82',
      definition:
        "Polycystic ovary syndrome (PCOS) is a common endocrine condition characterized by irregular or absent menstrual cycles, signs of excess androgens (such as acne or excess hair growth), and often insulin resistance. It's one of the most common causes of ovulation-related infertility.",
      alarmSymptoms: [
        'Sudden, very intense acute pelvic pain',
        'Severe nausea or vomiting associated with the pain',
        'High fever',
        'Sudden fainting or dizziness',
        'Heavy, abnormal vaginal bleeding',
      ],
      fields: [
        { key: 'cycle_day', type: 'number', label: 'Cycle day (optional)', placeholder: 'e.g. 14' },
        {
          key: 'cycle_length',
          type: 'number',
          label: 'Length of last cycle (days)',
          placeholder: 'e.g. 28',
          badge: (e) =>
            e
              ? e < 21
                ? { label: 'Short cycle', level: 'moderate' }
                : e <= 35
                  ? { label: 'Normal (21-35)', level: 'normal' }
                  : { label: 'Long cycle', level: 'moderate' }
              : null,
        },
        {
          key: 'androgen_symptoms',
          type: 'chips',
          label: 'Androgenic symptoms today',
          options: ['Acne', 'Facial/body hair growth', 'Hair thinning'],
        },
        {
          key: 'sugar_cravings',
          type: 'select',
          label: 'Sugar/carb cravings today',
          options: [
            { value: 'nessuna', label: 'None' },
            { value: 'lievi', label: 'Mild' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'intense', label: 'Intense' },
          ],
        },
        {
          key: 'weight',
          type: 'number',
          label: 'Weight (kg, optional)',
          placeholder: 'e.g. 65',
          unit: 'kg',
        },
      ],
      lifestyle: {
        helps: [
          'Low glycemic-index, fiber-rich diet',
          'Regular physical activity (helps insulin sensitivity)',
          'Monitoring cycle regularity and length',
          'Good sleep and stress management',
        ],
        avoid: [
          'Ultra-processed foods and refined sugars',
          'Prolonged fasting and drastic diets',
          'Ignoring absent cycles for many consecutive months without talking to your doctor',
        ],
      },
      contentCards: [
        {
          title: 'Rotterdam criteria',
          body: 'PCOS diagnosis is based on the Rotterdam criteria: at least 2 of 3 among irregular cycles/anovulation, signs of androgen excess, and polycystic ovaries on ultrasound. Only a doctor can make the diagnosis — the app helps you track your data.',
        },
        {
          title: 'Insulin resistance and lifestyle',
          body: 'Many people with PCOS have insulin resistance. Regular physical activity and a low glycemic-index diet can improve insulin sensitivity and cycle regularity.',
        },
      ],
    },
    ipertiroidismo: {
      key: 'ipertiroidismo',
      label: 'Hyperthyroidism',
      emoji: '⚡',
      color: '#C9694F',
      definition:
        "Hyperthyroidism is a condition in which the thyroid produces excess thyroid hormones, speeding up the body's metabolism. It can cause a fast or irregular heartbeat, unintentional weight loss, tremor, excessive sweating, anxiety, and insomnia. The most common cause is Graves' disease.",
      alarmSymptoms: [
        'Chest pain',
        'Fainting',
        'Difficulty breathing',
        'Very fast heart rate (>120 bpm at rest)',
        'Very slow heart rate (<45 bpm)',
        'Sudden confusion',
        'High fever (>38.5°C)',
      ],
      fields: [
        {
          key: 'heart_rate',
          type: 'number',
          label: 'Resting heart rate (bpm, optional)',
          placeholder: 'e.g. 80',
          badge: (e) =>
            e
              ? e < 45
                ? { label: 'Very low', level: 'high' }
                : e < 60
                  ? { label: 'Low', level: 'low' }
                  : e <= 100
                    ? { label: 'Normal', level: 'normal' }
                    : e <= 120
                      ? { label: 'High', level: 'moderate' }
                      : { label: 'Very high', level: 'high' }
              : null,
        },
        {
          key: 'weight',
          type: 'number',
          label: 'Weight (kg, optional)',
          placeholder: 'e.g. 65',
          unit: 'kg',
        },
        {
          key: 'symptoms',
          type: 'chips',
          label: 'Symptoms today',
          options: [
            'Palpitations',
            'Tremor',
            'Excessive sweating',
            'Insomnia',
            'Irritability/anxiety',
          ],
        },
      ],
      lifestyle: {
        helps: [
          'Taking therapy exactly as prescribed and at the indicated times',
          'Monitoring heart rate and weight',
          'Limiting caffeine',
          'Adequate rest despite the perceived hyperactivity',
        ],
        avoid: [
          'Stopping or changing therapy without talking to your doctor',
          'Excess iodine without medical supervision',
          'Ignoring persistent palpitations or rapid, significant weight loss',
        ],
      },
      contentCards: [
        {
          title: "Graves' disease",
          body: "The most common cause of hyperthyroidism is Graves' disease, an autoimmune disease in which the immune system stimulates the thyroid to produce too many hormones. Other causes exist too — your doctor will determine the specific one in your case.",
        },
        {
          title: 'Monitoring heart rate and weight',
          body: 'Regularly recording resting heart rate and weight helps track progress over time. Rapid, significant changes should be reported promptly to your doctor.',
        },
      ],
    },
    ipotiroidismo: {
      key: 'ipotiroidismo',
      label: 'Hypothyroidism',
      emoji: '🐢',
      color: '#5A5FA6',
      definition:
        "Hypothyroidism is a condition in which the thyroid doesn't produce enough thyroid hormones, slowing down the body's metabolism. It can cause persistent fatigue, weight gain, cold intolerance, constipation, dry skin, hair loss, and difficulty concentrating. The most common cause is Hashimoto's thyroiditis.",
      alarmSymptoms: [
        'Chest pain',
        'Fainting',
        'Difficulty breathing',
        'Very fast heart rate (>120 bpm at rest)',
        'Very slow heart rate (<45 bpm)',
        'Sudden confusion',
        'High fever (>38.5°C)',
      ],
      fields: [
        { key: 'fatigue', type: 'slider', label: 'Fatigue level', min: 0, max: 10 },
        {
          key: 'weight',
          type: 'number',
          label: 'Weight (kg, optional)',
          placeholder: 'e.g. 65',
          unit: 'kg',
        },
        {
          key: 'symptoms',
          type: 'chips',
          label: 'Symptoms today',
          options: [
            'Cold intolerance',
            'Constipation',
            'Dry skin/hair loss',
            'Difficulty concentrating',
            'Low mood',
          ],
        },
        {
          key: 'daytime_sleepiness',
          type: 'select',
          label: 'Daytime sleepiness?',
          options: [
            { value: 'si', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          key: 'mood_today',
          type: 'select',
          label: 'How would you describe your mood today?',
          options: [
            { value: 'ottimo', label: 'Great' },
            { value: 'buono', label: 'Good' },
            { value: 'normale', label: 'Normal' },
            { value: 'triste', label: 'Sad' },
            { value: 'molto_depresso', label: 'Very depressed' },
          ],
        },
        {
          key: 'bp_systolic',
          type: 'number',
          label: 'Systolic blood pressure (mmHg, optional)',
          placeholder: 'e.g. 120',
        },
        {
          key: 'bp_diastolic',
          type: 'number',
          label: 'Diastolic blood pressure (mmHg, optional)',
          placeholder: 'e.g. 80',
          badge: (e, t) => {
            if (!e || !(t != null && t.bp_systolic)) return null
            const n = t.bp_systolic
            return n >= 140 || e >= 90
              ? { label: 'Elevated', level: 'high' }
              : n >= 130 || e >= 80
                ? { label: 'Above normal', level: 'moderate' }
                : { label: 'Normal', level: 'normal' }
          },
        },
        {
          key: 'body_temp',
          type: 'number',
          label: 'Body temperature (°C, optional)',
          placeholder: 'e.g. 36.5',
          badge: (e) =>
            e
              ? e < 36.1
                ? { label: 'Low', level: 'low' }
                : e <= 37.2
                  ? { label: 'Normal', level: 'normal' }
                  : e <= 38
                    ? { label: 'Low-grade fever', level: 'moderate' }
                    : { label: 'Fever', level: 'high' }
              : null,
        },
        {
          key: 'thyroid_intensity',
          type: 'slider',
          label: 'How intense were your thyroid symptoms today?',
          min: 1,
          max: 10,
        },
      ],
      lifestyle: {
        helps: [
          'Taking levothyroxine fasting, always at the same time, as prescribed',
          'Waiting at least 30-60 minutes before eating or taking other medications/supplements',
          'Regular, light physical activity',
          'Balanced diet with adequate fiber intake',
        ],
        avoid: [
          'Taking levothyroxine together with calcium, iron, or coffee (reduces absorption)',
          'Stopping therapy because you "feel better"',
          "Ignoring extreme, persistent fatigue thinking it's just stress",
        ],
      },
      contentCards: [
        {
          title: "Hashimoto's thyroiditis",
          body: "The most common cause of hypothyroidism is Hashimoto's thyroiditis, an autoimmune disease in which the immune system attacks the thyroid, reducing its function. It's diagnosed through blood tests (TSH, FT4, anti-TPO antibodies).",
        },
        {
          title: 'Levothyroxine: absorption matters',
          body: 'Levothyroxine should be taken fasting, preferably in the morning, waiting 30-60 minutes before eating or taking other medications/supplements (especially calcium and iron, which reduce its absorption). Consistent timing improves value stability.',
        },
      ],
    },
    fibromialgia: {
      key: 'fibromialgia',
      label: 'Fibromyalgia',
      emoji: '🌫️',
      color: '#9B6B8C',
      definition:
        'Fibromyalgia is a chronic disease characterized by widespread musculoskeletal pain, present for at least three months, often accompanied by stiffness, unrefreshing sleep, chronic fatigue, and difficulty concentrating (the so-called "brain fog"). It mainly affects women, peaking between 40 and 60 years of age.',
      alarmSymptoms: [
        'Chest pain',
        'Sudden severe weakness on one side of the body',
        'High fever (>38.5°C)',
        'Sudden, intense swelling of a single joint',
        'Significant unexplained weight loss',
      ],
      fields: [
        {
          key: 'pain_areas',
          type: 'chips',
          label: 'Painful body areas today (WPI)',
          options: [
            'Arms',
            'Legs',
            'Back',
            'Neck and shoulders',
            'Chest',
            'Abdomen',
            'Head and face',
          ],
        },
        {
          key: 'restful_sleep',
          type: 'select',
          label: 'Restful sleep last night?',
          options: [
            { value: 'si', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          key: 'brain_fog',
          type: 'select',
          label: 'Brain fog today',
          options: [
            { value: 'nessuna', label: 'None' },
            { value: 'lieve', label: 'Mild' },
            { value: 'moderata', label: 'Moderate' },
            { value: 'intensa', label: 'Intense' },
          ],
        },
        {
          key: 'morning_stiffness_min',
          type: 'number',
          label: 'Morning stiffness (minutes, optional)',
          placeholder: 'e.g. 30',
          unit: 'min',
        },
        { key: 'fatigue', type: 'slider', label: 'Fatigue level', min: 0, max: 10 },
        {
          key: 'triggers',
          type: 'chips',
          label: 'Possible triggers today',
          options: ['Stress', 'Weather changes', 'Physical exertion', 'Poor sleep'],
        },
      ],
      trendField: { key: 'fatigue', label: 'Fatigue level' },
      lifestyle: {
        helps: [
          'Light, gradual physical activity (stretching, swimming, walking)',
          'Stress management and relaxation techniques',
          'Regular sleep hours',
          'Pacing activities, alternating effort and rest',
        ],
        avoid: [
          'Sudden, intense physical exertion',
          'Long periods of total inactivity',
          `Ignoring a marked worsening thinking it's "just fatigue"`,
        ],
      },
      contentCards: [
        {
          title: `It's not "all in your head"`,
          body: 'Fibromyalgia is a real, recognized condition characterized by heightened sensitivity to pain. It is not imagined, and the pain you feel is real. A clear diagnosis helps you start the most suitable path.',
        },
        {
          title: 'Pace and gradual progress',
          body: 'Light, regular physical activity, consistent sleep, and stress management are among the most effective elements. The goal is not intensity but consistency: small steps repeated over time.',
        },
      ],
    },
    artrite_reumatoide: {
      key: 'artrite_reumatoide',
      label: 'Rheumatoid Arthritis',
      emoji: '🦴',
      color: '#8C7355',
      definition:
        'Rheumatoid arthritis is a chronic inflammatory autoimmune disease that causes pain, swelling, stiffness, and progressive loss of joint function. It most often affects the small joints of the hands, wrists, and feet, symmetrically. It differs from osteoarthritis, which is a degenerative process related to joint wear, not autoimmune.',
      alarmSymptoms: [
        'High fever with a very hot, swollen, and painful joint (possible septic arthritis)',
        'Chest pain or difficulty breathing',
        'Intense eye redness and pain',
        'Sudden numbness or weakness',
        'Sudden, severe swelling of multiple joints with general malaise',
      ],
      fields: [
        {
          key: 'morning_stiffness_min',
          type: 'number',
          label: 'Morning stiffness (minutes)',
          placeholder: 'e.g. 45',
          unit: 'min',
        },
        {
          key: 'joint_swelling',
          type: 'select',
          label: 'Joint swelling today?',
          options: [
            { value: 'si', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        },
        {
          key: 'affected_joints',
          type: 'chips',
          label: 'Joints involved today',
          options: [
            'Hands and wrists',
            'Elbows',
            'Shoulders',
            'Knees',
            'Ankles and feet',
            'Cervical spine',
          ],
        },
        {
          key: 'daily_impact',
          type: 'select',
          label: 'Impact on daily activities',
          options: [
            { value: 'nessuno', label: 'None' },
            { value: 'lieve', label: 'Mild' },
            { value: 'moderato', label: 'Moderate — I reduced activities' },
            { value: 'severo', label: 'Severe — I had to stop' },
          ],
        },
      ],
      trendField: { key: 'morning_stiffness_min', label: 'Morning stiffness (min)' },
      lifestyle: {
        helps: [
          'Taking therapy regularly, even during symptom-free periods',
          'Low-impact physical activity to maintain joint mobility',
          'Applying heat or cold to aching joints as advised by your doctor',
          'Protecting joints in everyday tasks',
        ],
        avoid: [
          'Stopping therapy because you "feel better"',
          'Repeated, prolonged joint strain during a flare',
          'Ignoring a single very hot, swollen joint, especially with fever',
        ],
      },
      contentCards: [
        {
          title: 'Rheumatoid arthritis and osteoarthritis are not the same',
          body: 'Rheumatoid arthritis is an autoimmune disease: the immune system attacks the joints causing inflammation. Osteoarthritis is instead a degenerative process related to cartilage wear. They have different causes, treatments, and outcomes to clarify with your rheumatologist.',
        },
        {
          title: 'Morning stiffness is an important signal',
          body: 'Stiffness on waking, and how long it takes to improve, is an indicator that helps your rheumatologist understand disease activity. Logging the number of minutes each day helps build a useful picture for your visits.',
        },
      ],
    },
  },
}

const PAIN_BADGES = {
  it: [
    { range: [0, 3], label: 'Lieve', level: 'normal' },
    { range: [4, 6], label: 'Moderato', level: 'moderate' },
    { range: [7, 10], label: 'Severo', level: 'high' },
  ],
  en: [
    { range: [0, 3], label: 'Mild', level: 'normal' },
    { range: [4, 6], label: 'Moderate', level: 'moderate' },
    { range: [7, 10], label: 'Severe', level: 'high' },
  ],
}

const BADGE_STYLES = {
  low: { bg: '#EAF1FB', text: '#3A5A80' },
  normal: { bg: '#EAF3EE', text: '#3B5F52' },
  moderate: { bg: '#FBF0E3', text: '#7A5623' },
  high: { bg: '#FBEAEC', text: '#8A3A45' },
}

export const MOOD_LEVELS = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
]

const MEDICATION_OPTIONS = {
  it: [
    { value: 'yes', label: 'Sì' },
    { value: 'later', label: 'Lo prenderò più tardi' },
    { value: 'no', label: 'No' },
  ],
  en: [
    { value: 'yes', label: 'Yes' },
    { value: 'later', label: "I'll take it later" },
    { value: 'no', label: 'No' },
  ],
}

const DOC_TYPES = {
  it: {
    analisi_sangue: { label: 'Analisi del sangue', emoji: '🩸' },
    risonanza: { label: 'Risonanza magnetica', emoji: '🧲' },
    tac: { label: 'TAC', emoji: '🩻' },
    ecografia: { label: 'Ecografia', emoji: '🌊' },
    visita: { label: 'Visita specialistica', emoji: '🩺' },
    altro: { label: 'Altro', emoji: '📄' },
  },
  en: {
    analisi_sangue: { label: 'Blood test', emoji: '🩸' },
    risonanza: { label: 'MRI scan', emoji: '🧲' },
    tac: { label: 'CT scan', emoji: '🩻' },
    ecografia: { label: 'Ultrasound', emoji: '🌊' },
    visita: { label: 'Specialist visit', emoji: '🩺' },
    altro: { label: 'Other', emoji: '📄' },
  },
}

const SPECIALISTS = {
  it: {
    ginecologo: 'Ginecologo/a',
    gastroenterologo: 'Gastroenterologo/a',
    neurologo: 'Neurologo/a',
    diabetologo: 'Diabetologo/a',
    medico_base: 'Medico di base',
  },
  en: {
    ginecologo: 'Gynecologist',
    gastroenterologo: 'Gastroenterologist',
    neurologo: 'Neurologist',
    diabetologo: 'Diabetologist',
    medico_base: 'General practitioner',
  },
}

const FREQUENCIES = {
  it: [
    { value: 'ogni_giorno', label: 'Ogni giorno' },
    { value: 'settimanale', label: 'Settimanale' },
    { value: 'al_bisogno', label: 'Al bisogno' },
  ],
  en: [
    { value: 'ogni_giorno', label: 'Every day' },
    { value: 'settimanale', label: 'Weekly' },
    { value: 'al_bisogno', label: 'As needed' },
  ],
}

/** Modules where pain is not the cardinal symptom, so the pain slider is hidden. */
export const NO_PAIN_MODULES = ['ipertiroidismo', 'ipotiroidismo']

export function getConditionList(lang) {
  return Object.values(CONDITIONS[lang] || CONDITIONS.it)
}

export function getCondition(key, lang) {
  return (key && (CONDITIONS[lang] || CONDITIONS.it)[key]) || null
}

export function getPainBadges(lang) {
  return PAIN_BADGES[lang] || PAIN_BADGES.it
}

export function getBadgeStyle(level) {
  const s = BADGE_STYLES[level]
  return s ? { backgroundColor: s.bg, color: s.text } : {}
}

export function getMedicationOptions(lang) {
  return MEDICATION_OPTIONS[lang] || MEDICATION_OPTIONS.it
}

export function getDocTypes(lang) {
  return DOC_TYPES[lang] || DOC_TYPES.it
}

export function getSpecialists(lang) {
  return SPECIALISTS[lang] || SPECIALISTS.it
}

export function getFrequencies(lang) {
  return FREQUENCIES[lang] || FREQUENCIES.it
}
