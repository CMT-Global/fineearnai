import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion";
  
  const faqs = [
    {
      question: "Will I make real money on ProfitChips?",
      answer: "Absolutely. Once you pass the qualification for a project, you'll earn money for every task you complete. Payment rates vary by project complexity, language, and task type. Many contributors earn a sustainable side income.",
    },
    {
      question: "Can I get started on the tasks today?",
      answer: "Yes! You can start immediately. The onboarding process takes less than 10 minutes — just answer a few basic questions, create your profile, and you'll have instant access to start exploring tasks right away.",
    },
    {
      question: "How am I ensured that I'm being paid fairly?",
      answer: "We maintain transparent pay rates for all projects, benchmarked against industry standards. All task durations and pay rates are disclosed upfront before you begin any work.",
    },
    {
      question: "I don't have any work experience or background in technology. Can I still do the tasks?",
      answer: "Yes! Many of our tasks are designed for people without technical backgrounds. We provide comprehensive training materials and practice sessions. Your unique perspective is valuable to AI development.",
    },
    {
      question: "Will there always be tasks for me to do?",
      answer: "Task availability varies by project and demand. We recommend joining multiple projects to ensure consistent work. We notify contributors when new tasks or projects become available.",
    },
  ];
  
  export default function LandingFAQSection() {
    return (
      <section id="faq" className="section-padding relative">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Frequently Asked <span className="text-gradient">Questions</span>
              </h2>
              <p className="text-muted-foreground">
                Got questions? We've got answers. Can't find what you're looking for? Contact our support team.
              </p>
            </div>
  
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="glass-card px-6 border-border/50 data-[state=open]:border-primary/30 transition-colors"
                >
                  <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    );
  }
  