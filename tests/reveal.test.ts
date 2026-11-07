import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchSections } from "@/lib/reveal";

/** Une section réduite à ce que la surveillance touche : ses attributs. */
function section() {
  const attrs = new Set<string>();
  return {
    attrs,
    setAttribute: (name: string) => void attrs.add(name),
    hasAttribute: (name: string) => attrs.has(name),
  };
}
type Section = ReturnType<typeof section>;

class FakeIO {
  static all: FakeIO[] = [];
  observed = new Set<Section>();
  constructor(private readonly callback: (entries: { isIntersecting: boolean; target: Section }[]) => void) {
    FakeIO.all.push(this);
  }
  observe(el: Section) {
    this.observed.add(el);
  }
  unobserve(el: Section) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
  /** La section arrive à l'écran : seul un observateur qui la suit encore le voit. */
  reach(el: Section) {
    if (this.observed.has(el)) this.callback([{ isIntersecting: true, target: el }]);
  }
}

class FakeMO {
  static all: FakeMO[] = [];
  connected = true;
  constructor(readonly callback: () => void) {
    FakeMO.all.push(this);
  }
  observe() {}
  disconnect() {
    this.connected = false;
  }
}

/** Les sections que retient un sélecteur : il compte ses `:not([attribut])`, comme le ferait le navigateur. */
function page(sections: Section[]) {
  return {
    body: {},
    querySelectorAll: (selector: string) => {
      const excluded = [...selector.matchAll(/:not\(\[([\w-]+)\]\)/g)].map((m) => m[1]);
      return sections.filter((s) => !excluded.some((name) => s.hasAttribute(name)));
    },
  } as unknown as Document;
}

/** Une mutation du DOM : tous les observateurs encore branchés sont prévenus. */
function mutate() {
  for (const mo of FakeMO.all) if (mo.connected) mo.callback();
}

describe("watchSections", () => {
  beforeEach(() => {
    FakeIO.all = [];
    FakeMO.all = [];
    vi.stubGlobal("IntersectionObserver", FakeIO);
    vi.stubGlobal("MutationObserver", FakeMO);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fait entrer une section quand on l'atteint, et cesse de la suivre", () => {
    const a = section();
    watchSections(page([a]));
    const io = FakeIO.all[0];
    expect(a.hasAttribute("data-in")).toBe(false);
    io.reach(a);
    expect(a.hasAttribute("data-in")).toBe(true);
    expect(io.observed.has(a)).toBe(false);
  });

  it("voit arriver les sections d'une nouvelle page", () => {
    const sections: Section[] = [];
    watchSections(page(sections));
    const fresh = section();
    sections.push(fresh);
    mutate();
    FakeIO.all[0].reach(fresh);
    expect(fresh.hasAttribute("data-in")).toBe(true);
  });

  it("ne reprend pas une section déjà entrée", () => {
    const a = section();
    const sections = [a];
    watchSections(page(sections));
    const io = FakeIO.all[0];
    io.reach(a);
    mutate();
    expect(io.observed.has(a)).toBe(false);
  });

  // Le bug : à un clic, l'ancienne surveillance voyait la page arriver et la notait comme suivie,
  // puis s'arrêtait. La suivante, voyant la marque, n'en reprenait aucune : page invisible.
  it("une surveillance relancée reprend ce que la précédente suivait", () => {
    const sections: Section[] = [];
    const stop = watchSections(page(sections));
    const fresh = section();
    sections.push(fresh);
    mutate();
    stop();
    watchSections(page(sections));
    FakeIO.all[1].reach(fresh);
    expect(fresh.hasAttribute("data-in")).toBe(true);
  });
});
