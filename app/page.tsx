const services = [
  {
    title: "Weekly",
    price: "$18",
    description:
      "Our most popular option for keeping your yard consistently clean.",
    included: "1 dog included",
    additional: "+ $5 per additional dog",
    popular: true,
  },
  {
    title: "Every Other Week",
    price: "$23",
    description:
      "A great option for yards that don't need weekly attention.",
    included: "1 dog included",
    additional: "+ $5 per additional dog",
    popular: false,
  },
  {
    title: "Twice Weekly",
    price: "$32",
    description:
      "Extra-frequent service for busy households and multiple dogs.",
    included: "1 dog included",
    additional: "+ $5 per additional dog",
    popular: false,
  },
  {
    title: "One-Time Cleanup",
    price: "$25",
    description:
      "Need the yard cleaned up now? We'll take care of it.",
    included: "Starting price",
    additional: "Custom pricing for unusual jobs",
    popular: false,
  },
];

const serviceAreas = ["80916", "80915", "80917", "80910", "80909"];

const steps = [
  {
    number: "1",
    title: "Request a Quote",
    description:
      "Tell us about your dogs and choose an available time for your initial consultation.",
  },
  {
    number: "2",
    title: "Get Your Price",
    description:
      "We'll take a look at the yard and give you a straightforward price before recurring service begins.",
  },
  {
    number: "3",
    title: "We Scoop",
    description:
      "Choose your weekly or every-other-week schedule and let us handle the mess.",
  },
];

const faqs = [
  {
    question: "Is the first cleanup really free?",
    answer:
      "Yes! New customers who start a recurring service receive their first cleanup completely free.",
  },
  {
    question: "How much is each additional dog?",
    answer:
      "Our recurring service pricing includes one dog. Each additional dog is just $5 more per visit.",
  },
  {
    question: "Do you charge based on yard size?",
    answer:
      "Not normally. Standard recurring pricing is based on the number of dogs and how often we visit. Unusually large or heavily soiled yards may receive a custom quote.",
  },
  {
    question: "Is deodorizing included?",
    answer:
      "Deodorizing is an optional add-on and is not included in the standard scooping price. You can add it to your service whenever you'd like.",
  },
  {
    question: "How much does deodorizing cost?",
    answer:
      "Weekly deodorizing is $15 per visit, bi-weekly deodorizing is $20 per visit, and one-time or spring deodorizing cleanups are $35–$45.",
  },
  {
    question: "How does scheduling work?",
    answer:
      "First, you'll choose an available time for your initial consultation. After you've received and accepted your quote, you'll be able to choose from available recurring service days and times.",
  },
  {
    question: "How often can you come?",
    answer:
      "We offer weekly, every-other-week, and twice-weekly recurring service, along with one-time cleanups.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FEFBF7] text-[#0A1821]">

      {/* ==================== NAVIGATION ==================== */}
      <header className="sticky top-0 z-50 border-b border-[#0A1821]/10 bg-[#FEFBF7]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">

          <a href="#" className="flex items-center">
            <img
              src="/dooty-done-logo.png"
              alt="Dooty Done Pet Waste Removal"
              className="h-16 w-auto object-contain"
            />
          </a>

          <nav className="hidden items-center gap-8 text-sm font-extrabold lg:flex">

            <a
              href="#services"
              className="transition hover:text-[#678739]"
            >
              Services
            </a>

            <a
              href="#pricing"
              className="transition hover:text-[#678739]"
            >
              Pricing
            </a>

            <a
              href="#how-it-works"
              className="transition hover:text-[#678739]"
            >
              How It Works
            </a>

            <a
              href="#faq"
              className="transition hover:text-[#678739]"
            >
              FAQ
            </a>

            <a
              href="#quote"
              className="transition hover:text-[#678739]"
            >
              Contact
            </a>

          </nav>

          <a
            href="#quote"
            className="rounded-full bg-[#678739] px-6 py-3.5 text-sm font-extrabold text-white shadow-md transition hover:bg-[#536f2e] hover:shadow-lg"
          >
            Get a Free Quote
          </a>

        </div>
      </header>


      {/* ==================== HERO ==================== */}
      <section className="relative min-h-[720px] overflow-hidden">

        {/* Full-width backyard photo */}
        <img
          src="/hero-photo.jpg"
          alt="Happy dog enjoying a Colorado Springs backyard"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Cream fade behind text */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FEFBF7]/94 via-[#FEFBF7]/55 to-transparent" />

        <div className="relative mx-auto min-h-[720px] max-w-7xl px-5 sm:px-8">

          {/* LEFT SIDE */}
          <div className="relative z-20 flex min-h-[720px] items-center py-16 sm:py-20 lg:max-w-[59%]">

            <div className="max-w-2xl">

              <div className="mb-7 inline-flex rounded-full border border-[#678739]/25 bg-[#FEFBF7]/90 px-5 py-2.5 text-sm font-extrabold text-[#536f2e] shadow-sm backdrop-blur-sm">
                Colorado Springs' Local Dog Waste Removal
              </div>

              <h1 className="text-5xl font-black leading-[0.98] tracking-tight text-[#0A1821] sm:text-6xl lg:text-7xl xl:text-8xl">

                We Scoop.

                <br />

                <span className="text-[#678739]">
                  You Relax.
                </span>

              </h1>

              {/* Signature underline */}
              <div className="mt-6 h-2 w-28 rounded-full bg-[#678739]" />

              <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-[#0A1821]/85 sm:text-xl">
                Professional, reliable dog waste removal so you can enjoy a
                cleaner yard and more time with your dog.
              </p>

              {/* CTA buttons */}
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">

                <a
                  href="#quote"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-[#678739] px-8 py-4 text-base font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#536f2e]"
                >
                  Get Your Free Quote
                  <span className="text-xl">
                    →
                  </span>
                </a>

                <a
                  href="#services"
                  className="inline-flex items-center justify-center rounded-full border-2 border-[#0A1821]/20 bg-[#FEFBF7]/95 px-8 py-4 text-base font-black text-[#0A1821] shadow-md backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#678739]"
                >
                  View Services
                </a>

              </div>

              {/* Hero benefits */}
              <div className="mt-9 grid gap-5 sm:grid-cols-3">

                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#678739] font-black text-white shadow-md">
                    ✓
                  </div>

                  <div>
                    <p className="font-black text-[#0A1821]">
                      Locally Owned
                    </p>

                    <p className="text-sm leading-5 text-[#0A1821]/65">
                      Proudly serving Colorado Springs
                    </p>
                  </div>

                </div>


                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#678739] font-black text-white shadow-md">
                    ✓
                  </div>

                  <div>
                    <p className="font-black text-[#0A1821]">
                      Flexible Scheduling
                    </p>

                    <p className="text-sm leading-5 text-[#0A1821]/65">
                      Weekly, biweekly or twice weekly
                    </p>
                  </div>

                </div>


                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#678739] font-black text-white shadow-md">
                    ✦
                  </div>

                  <div>
                    <p className="font-black text-[#0A1821]">
                      Optional Deodorizing
                    </p>

                    <p className="text-sm leading-5 text-[#0A1821]/65">
                      Add odor treatment when you want it
                    </p>
                  </div>

                </div>

              </div>

            </div>

          </div>


          {/* ==================== UPPER-RIGHT LOGO ==================== */}
          <div className="pointer-events-none absolute right-0 top-0 z-30 hidden h-full w-[500px] lg:block">

            <img
              src="/dooty-done-logo-transparent.png"
              alt="Dooty Done Pet Waste Removal"
              className="absolute right-[-300px] top-6 w-[470px] object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.30)]"
            />

          </div>

        </div>
      </section>


      {/* ==================== FREE FIRST CLEANUP ==================== */}
      <section className="border-y-4 border-[#678739] bg-[#0A1821] text-white">

        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 py-10 text-center sm:px-8 md:flex-row md:justify-center md:text-left">

          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#678739] text-3xl font-black shadow-lg">
            ✓
          </div>

          <div>

            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#A4C36B]">
              New Recurring Customers
            </p>

            <h2 className="mt-1 text-3xl font-black sm:text-4xl">
              Your first cleanup is{" "}
              <span className="text-[#A4C36B]">
                FREE.
              </span>
            </h2>

          </div>

          <div className="hidden h-12 w-px bg-white/25 md:block" />

          <p className="max-w-md text-white/85">
            Start a recurring service and we'll take care of the first
            cleanup on us.
          </p>

        </div>
      </section>


      {/* ==================== SERVICES / PRICING ==================== */}
      <section
        id="services"
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8"
      >

        <div className="mx-auto max-w-3xl text-center">

          <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
            Our Services
          </p>

          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Pick the schedule that works for you.
          </h2>

          <p className="mt-5 text-lg leading-8 text-[#0A1821]/65">
            Straightforward pricing based on the number of dogs and the
            frequency you need.
          </p>

        </div>


        {/* Scooping pricing */}
        <div
          id="pricing"
          className="mt-12 grid gap-5 sm:grid-cols-2"
        >

          {services.map((service) => (

            <div
              key={service.title}
              className={`relative rounded-3xl border bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                service.popular
                  ? "border-[#678739] ring-2 ring-[#678739]/10"
                  : "border-[#0A1821]/10"
              }`}
            >

              {service.popular && (
                <span className="absolute right-6 top-6 rounded-full bg-[#678739]/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#536f2e]">
                  Most Popular
                </span>
              )}

              <h3 className="text-2xl font-black">
                {service.title}
              </h3>

              <div className="mt-5">

                <span className="text-4xl font-black text-[#678739]">
                  {service.price}
                </span>

                {service.title !== "One-Time Cleanup" && (
                  <span className="ml-2 font-semibold text-[#0A1821]/50">
                    / visit
                  </span>
                )}

              </div>

              <p className="mt-4 leading-7 text-[#0A1821]/65">
                {service.description}
              </p>

              <div className="mt-5 rounded-2xl bg-[#F1F5EA] p-4">

                <p className="font-extrabold text-[#0A1821]">
                  {service.included}
                </p>

                <p className="mt-1 text-lg font-black text-[#678739]">
                  {service.additional}
                </p>

              </div>

            </div>

          ))}

        </div>


        {/* Cleanup scale */}
        <div className="mt-8 rounded-3xl border border-[#678739]/20 bg-[#F1F5EA] p-6">

          <h3 className="text-xl font-black">
            What can affect the price?
          </h3>

          <p className="mt-2 leading-7 text-[#0A1821]/70">
            Standard recurring pricing is based on the number of dogs and
            service frequency. We don't normally charge based on yard size.
            For unusually accumulated waste, we use a simple cleanup scale:
            <strong className="text-[#0A1821]">
              {" "}Light → Medium → Heavy → Extreme.
            </strong>
            {" "}If your yard needs additional cleanup beyond our standard
            service, we'll let you know the price before we begin.
          </p>

        </div>


        {/* ==================== OPTIONAL DEODORIZING ==================== */}
        <div className="mt-8 rounded-3xl border-2 border-[#678739]/20 bg-white p-8 shadow-sm">

          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

            <div className="max-w-2xl">

              <div className="flex items-center gap-3">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#678739] text-2xl text-white">
                  ✦
                </div>

                <div>

                  <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#678739]">
                    Optional Add-On
                  </p>

                  <h3 className="text-2xl font-black">
                    Fresh Yard Deodorizing
                  </h3>

                </div>

              </div>

              <p className="mt-4 leading-7 text-[#0A1821]/70">
                Add a deodorizer treatment to help reduce lingering
                pet-waste odors and keep your yard smelling fresher between
                cleanups. Deodorizing is completely optional and is not
                included in standard scooping prices.
              </p>

            </div>


            <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-2xl">

              <div className="rounded-2xl bg-[#F1F5EA] p-5 text-center">

                <p className="text-sm font-extrabold text-[#536f2e]">
                  WEEKLY
                </p>

                <p className="mt-2 text-3xl font-black text-[#678739]">
                  $15
                </p>

                <p className="mt-1 text-xs font-semibold text-[#0A1821]/60">
                  per visit
                </p>

                <p className="mt-3 text-xs leading-5 text-[#0A1821]/65">
                  Best for standard yards under 3,000 sq. ft.
                </p>

              </div>


              <div className="rounded-2xl bg-[#F1F5EA] p-5 text-center">

                <p className="text-sm font-extrabold text-[#536f2e]">
                  BI-WEEKLY
                </p>

                <p className="mt-2 text-3xl font-black text-[#678739]">
                  $20
                </p>

                <p className="mt-1 text-xs font-semibold text-[#0A1821]/60">
                  per visit
                </p>

                <p className="mt-3 text-xs leading-5 text-[#0A1821]/65">
                  Heavier treatment for longer intervals between visits.
                </p>

              </div>


              <div className="rounded-2xl bg-[#F1F5EA] p-5 text-center">

                <p className="text-sm font-extrabold text-[#536f2e]">
                  ONE-TIME / SPRING
                </p>

                <p className="mt-2 text-3xl font-black text-[#678739]">
                  $35–$45
                </p>

                <p className="mt-1 text-xs font-semibold text-[#0A1821]/60">
                  flat fee
                </p>

                <p className="mt-3 text-xs leading-5 text-[#0A1821]/65">
                  For neglected yards needing a heavier treatment.
                </p>

              </div>

            </div>

          </div>

        </div>


        {/* Service features */}
        <div className="mt-6 grid gap-5 md:grid-cols-2">

          <div className="rounded-3xl border border-[#0A1821]/10 bg-white p-7 shadow-sm">

            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#678739]/12 text-2xl">
              ✓
            </div>

            <h3 className="mt-5 text-2xl font-black">
              Simple, Flexible Service
            </h3>

            <p className="mt-3 leading-7 text-[#0A1821]/65">
              Choose weekly, every-other-week, or twice-weekly scooping with
              clear pricing and flexible scheduling.
            </p>

          </div>


          <div className="rounded-3xl border border-[#0A1821]/10 bg-white p-7 shadow-sm">

            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#678739]/12 text-2xl">
              ✦
            </div>

            <h3 className="mt-5 text-2xl font-black">
              Add Deodorizing When You Need It
            </h3>

            <p className="mt-3 leading-7 text-[#0A1821]/65">
              Keep your standard scooping service simple, then add odor
              treatment whenever you'd like an extra-fresh yard.
            </p>

          </div>

        </div>

      </section>


      {/* ==================== HOW IT WORKS ==================== */}
      <section
        id="how-it-works"
        className="border-y border-[#678739]/15 bg-[#F5F7F1]"
      >

        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">

          <div className="mx-auto max-w-2xl text-center">

            <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
              How It Works
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Getting started is easy.
            </h2>

          </div>


          <div className="mt-14 grid gap-10 md:grid-cols-3">

            {steps.map((step) => (

              <div
                key={step.number}
                className="text-center"
              >

                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#678739] text-2xl font-black text-white shadow-lg">
                  {step.number}
                </div>

                <h3 className="mt-5 text-xl font-black">
                  {step.title}
                </h3>

                <p className="mx-auto mt-3 max-w-sm leading-7 text-[#0A1821]/65">
                  {step.description}
                </p>

              </div>

            ))}

          </div>

        </div>
      </section>


      {/* ==================== WHY DOOTY DONE ==================== */}
      <section className="bg-white">

        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">

          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">

            <div>

              <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
                Why Dooty Done?
              </p>

              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                More Than Just a Scoop.
              </h2>

              <p className="mt-5 max-w-xl text-lg leading-8 text-[#0A1821]/65">
                We make keeping your yard clean simple. Reliable service,
                straightforward pricing, flexible scheduling, and optional
                deodorizing when you want it.
              </p>

            </div>


            <div className="grid gap-4 sm:grid-cols-2">

              {[
                {
                  title: "Reliable",
                  description:
                    "Consistent service you can count on.",
                },
                {
                  title: "Simple Pricing",
                  description:
                    "1 dog included, then just $5 per additional dog.",
                },
                {
                  title: "Optional Deodorizing",
                  description:
                    "Add odor treatment whenever you'd like.",
                },
                {
                  title: "Flexible",
                  description:
                    "Choose weekly, biweekly, or twice-weekly service.",
                },
              ].map((item) => (

                <div
                  key={item.title}
                  className="rounded-3xl border border-[#0A1821]/10 bg-[#FEFBF7] p-6 shadow-sm"
                >

                  <div className="h-2 w-12 rounded-full bg-[#678739]" />

                  <h3 className="mt-5 text-xl font-black">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[#0A1821]/60">
                    {item.description}
                  </p>

                </div>

              ))}

            </div>

          </div>

        </div>
      </section>


      {/* ==================== SERVICE AREA ==================== */}
      <section className="bg-[#EAF0E2]">

        <div className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8">

          <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
            Service Area
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Serving Colorado Springs
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-[#0A1821]/65">
            Currently serving customers throughout these areas.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">

            {serviceAreas.map((zip) => (

              <span
                key={zip}
                className="rounded-full border border-[#678739]/25 bg-white px-5 py-2.5 font-black text-[#536f2e] shadow-sm"
              >
                {zip}
              </span>

            ))}

          </div>

        </div>
      </section>


      {/* ==================== FAQ ==================== */}
      <section
        id="faq"
        className="bg-white"
      >

        <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8">

          <div className="text-center">

            <p className="font-extrabold uppercase tracking-[0.18em] text-[#678739]">
              FAQ
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight">
              Common Questions
            </h2>

          </div>


          <div className="mt-10 space-y-4">

            {faqs.map((faq) => (

              <details
                key={faq.question}
                className="group rounded-2xl border border-[#0A1821]/10 bg-[#FEFBF7] p-6"
              >

                <summary className="cursor-pointer list-none font-black">

                  {faq.question}

                  <span className="float-right text-2xl font-normal text-[#678739] transition-transform group-open:rotate-45">
                    +
                  </span>

                </summary>

                <p className="mt-4 leading-7 text-[#0A1821]/65">
                  {faq.answer}
                </p>

              </details>

            ))}

          </div>

        </div>
      </section>


      {/* ==================== FINAL CTA ==================== */}
      <section
        id="quote"
        className="border-t-4 border-[#678739] bg-[#0A1821] text-white"
      >

        <div className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8">

          <p className="font-extrabold uppercase tracking-[0.18em] text-[#A4C36B]">
            Ready to Get Started?
          </p>

          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Let's get that yard{" "}
            <span className="text-[#A4C36B]">
              Dooty Done.
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/75">
            Request your free quote and take the first step toward a cleaner,
            better-smelling yard.
          </p>

          <a
            href="#quote"
            className="mt-8 inline-block rounded-full bg-[#678739] px-8 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#7A9B48]"
          >
            Get My Free Quote
          </a>

        </div>
      </section>


      {/* ==================== FOOTER ==================== */}
      <footer className="border-t border-[#678739]/15 bg-[#FEFBF7]">

        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-[#0A1821]/60 sm:px-8 md:flex-row md:items-center md:justify-between">

          <p>
            © {new Date().getFullYear()} Dooty Done LLC. All rights reserved.
          </p>

          <p className="font-semibold">
            Colorado Springs, Colorado
          </p>

        </div>
      </footer>

    </main>
  );
}