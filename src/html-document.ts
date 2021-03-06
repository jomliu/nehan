import {
  CssStyleSheet,
  HtmlElement,
  DefaultStyles,
  SelectorCache,
  CssLoader,
  BodyContext,
  BodyGenerator,
  PageGenerator,
  PageReader,
  Config,
} from "./public-api";

export interface HtmlDocumentOptions {
  styleSheets?: CssStyleSheet []
}

let defaultOptions: HtmlDocumentOptions = {
  styleSheets:[]
};

export class HtmlDocument {
  public source: string;
  public $document: HTMLDocument;
  public documentElement: HtmlElement;
  public body: HtmlElement;
  public styleSheets: CssStyleSheet [];
  public specStyleSheet: CssStyleSheet; // specificity sorted stylesheet.
  protected selectorCache: SelectorCache;

  constructor(source: string, options: HtmlDocumentOptions = defaultOptions){
    this.source = Config.normalizeHtml(source);
    this.styleSheets = [
      new CssStyleSheet(DefaultStyles)
    ].concat(options.styleSheets || []);
    this.specStyleSheet = this.styleSheets.reduce((acm, stylesheet) => {
      return acm.mergeStyleSheet(stylesheet);
    }, new CssStyleSheet({}));
    this.selectorCache = new SelectorCache();
    this.selectorCache.clear();

    //console.time("html-parse");
    this.$document = new DOMParser().parseFromString(this.source, "text/html");
    this.documentElement = this.createElementFromDOM(this.$document.documentElement);
    let body = this.documentElement.querySelector("body");
    if(!body){
      throw new Error("body not found");
    }
    this.body = body;
    this.body.parent = this.documentElement;
    //console.timeEnd("html-parse");

    // At this point, load styles of body only, because loading of each styles are heavy task.
    // So styles of children are dynamically loaded when it's required by layout generator.
    CssLoader.load(this.body);
  }

  // Load all styles of document at once.
  // Note that this is mainly used by test.
  // Normally, child styles are loaded when it's required by child generator.
  public loadCssAll(): HtmlDocument {
    CssLoader.loadAll(this.body);
    return this;
  }

  public createBodyGenerator(): BodyGenerator {
    return new BodyGenerator(new BodyContext(this.body));
  }

  public createPageGenerator(): PageGenerator {
    return new PageGenerator(this);
  }

  public createPageReader(): PageReader {
    return new PageReader(this);
  }

  public querySelectorAll(query: string): HtmlElement [] {
    return this.documentElement.querySelectorAll(query);
  }

  public querySelector(query: string): HtmlElement | null {
    return this.documentElement.querySelector(query);
  }

  public getElementById(id: string): HtmlElement | null {
    return this.querySelector("#" + id);
  }

  public getSelectorCache(selector: string): HtmlElement [] {
    return this.selectorCache.getCache(selector);
  }

  public addStyleSheet(stylesheet: CssStyleSheet): HtmlDocument {
    this.styleSheets.push(stylesheet);
    return this;
  }

  public addSelectorCache(tag_name: string, element: HtmlElement){
    this.selectorCache.addCache(tag_name, element);
  }

  public createElement(tag_name: string): HtmlElement {
    let element = this.createNativeElement(tag_name);
    return this.createElementFromDOM(element);
  }

  public createNativeElement(tag_name: string): HTMLElement {
    return this.$document.createElement(tag_name);
  }

  public createElementFromDOM(node: HTMLElement | Node): HtmlElement {
    let tag_name = (node instanceof HTMLElement)? node.tagName :
      (node instanceof Text)? "(text)" : "??";
    tag_name = tag_name.toLowerCase();
    if((tag_name === "body" || tag_name === "html") &&
       this.selectorCache.hasCache(tag_name)){
      return this.selectorCache.getCache(tag_name)[0];
    }
    let element = new HtmlElement(node, this);
    if(element.tagName === "body"){
      this.body = element;
    }
    element.root = this;
    this.selectorCache.addCache(tag_name, element);
    this.selectorCache.addCache("*", element);
    return element;
  }

  public createTextNode(text: string): HtmlElement {
    let element = this.$document.createTextNode(text);
    return this.createElementFromDOM(element);
  }
}

