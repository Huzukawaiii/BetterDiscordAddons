/**
 * @name SpellCheck
 * @author DevilBro
 * @authorId 278543574059057154
 * @version 1.6.4
 * @description Adds a Spell Check to all Message Inputs. Select a Word and Right Click it to add it to your Dictionary
 * @invite Jx3TjNS
 * @donate https://www.paypal.me/MircoWittrien
 * @patreon https://www.patreon.com/MircoWittrien
 * @website https://mwittrien.github.io/
 * @source https://github.com/mwittrien/BetterDiscordAddons/tree/master/Plugins/SpellCheck/
 * @updateUrl https://mwittrien.github.io/BetterDiscordAddons/Plugins/SpellCheck/SpellCheck.plugin.js
 */

module.exports = (_ => {
	const changeLog = {
		
	};
	
	return !window.BDFDB_Global || (!window.BDFDB_Global.loaded && !window.BDFDB_Global.started) ? class {
		constructor (meta) {for (let key in meta) this[key] = meta[key];}
		getName () {return this.name;}
		getAuthor () {return this.author;}
		getVersion () {return this.version;}
		getDescription () {return `The Library Plugin needed for ${this.name} is missing. Open the Plugin Settings to download it. \n\n${this.description}`;}
		
		downloadLibrary () {
			require("request").get("https://mwittrien.github.io/BetterDiscordAddons/Library/0BDFDB.plugin.js", (e, r, b) => {
				if (!e && b && r.statusCode == 200) require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0BDFDB.plugin.js"), b, _ => BdApi.showToast("Finished downloading BDFDB Library", {type: "success"}));
				else BdApi.alert("Error", "Could not download BDFDB Library Plugin. Try again later or download it manually from GitHub: https://mwittrien.github.io/downloader/?library");
			});
		}
		
		load () {
			if (!window.BDFDB_Global || !Array.isArray(window.BDFDB_Global.pluginQueue)) window.BDFDB_Global = Object.assign({}, window.BDFDB_Global, {pluginQueue: []});
			if (!window.BDFDB_Global.downloadModal) {
				window.BDFDB_Global.downloadModal = true;
				BdApi.showConfirmationModal("Library Missing", `The Library Plugin needed for ${this.name} is missing. Please click "Download Now" to install it.`, {
					confirmText: "Download Now",
					cancelText: "Cancel",
					onCancel: _ => {delete window.BDFDB_Global.downloadModal;},
					onConfirm: _ => {
						delete window.BDFDB_Global.downloadModal;
						this.downloadLibrary();
					}
				});
			}
			if (!window.BDFDB_Global.pluginQueue.includes(this.name)) window.BDFDB_Global.pluginQueue.push(this.name);
		}
		start () {this.load();}
		stop () {}
		getSettingsPanel () {
			let template = document.createElement("template");
			template.innerHTML = `<div style="color: var(--header-primary); font-size: 16px; font-weight: 300; white-space: pre; line-height: 22px;">The Library Plugin needed for ${this.name} is missing.\nPlease click <a style="font-weight: 500;">Download Now</a> to install it.</div>`;
			template.content.firstElementChild.querySelector("a").addEventListener("click", this.downloadLibrary);
			return template.content.firstElementChild;
		}
	} : (([Plugin, BDFDB]) => {
		var languages, dictionaries, langDictionaries, languageToasts, checkTimeout, currentText;
	
		return class SpellCheck extends Plugin {
			onLoad () {
				languages = {};
				dictionaries = {};
				langDictionaries = {};
				languageToasts = {};
				
				this.defaults = {
					general: {
						downloadDictionary:			{value: false, 								description: "Use local Dictionary File (downloads Dictionary on first Usage)"}
					},
					choices: {
						dictionaryLanguage:			{value: "en", 	force: true,				description: "Primary Language"},
						secondaryLanguage:			{value: "-", 	force: false,				description: "Secondary Language"}
					},
					amounts: {
						maxSimilarAmount:			{value: 6, 		min: 1,		max: 30,		description: "Maximal Amount of suggested Words"}
					}
				};
			
				this.patchedModules = {
					after: {
						ChannelEditorContainer: ["componentDidMount", "componentDidUpdate"]
					}
				};
				
				this.css = `
					${BDFDB.dotCNS._spellcheckoverlay + BDFDB.dotCN._spellcheckerror} {
						background: url('data:image/svg+xml; utf8, <svg xmlns="http://www.w3.org/2000/svg" width="4" height="3" viewBox="0 0 4 3" fill="red"><rect x="0" y="2" width="1" height="1"/><rect x="1" y="1" width="1" height="1"/><rect x="2" y="0" width="1" height="1"/><rect x="3" y="1" width="1" height="1"/></svg>') bottom repeat-x;
					}
				`;
			}
			
			onStart () {
				BDFDB.LibraryRequires.request("https://github.com/mwittrien/BetterDiscordAddons/tree/master/Plugins/SpellCheck/dic", (error, response, body) => {
					let dictionaryLanguageIds = Array.from(BDFDB.DOMUtils.create(body).querySelectorAll(`[href*="/mwittrien/BetterDiscordAddons/blob/master/Plugins/SpellCheck/dic/"]`)).map(n => n.innerText.split(".")[0]).filter(n => n);
					languages = BDFDB.ObjectUtils.filter(BDFDB.LanguageUtils.languages, langId => dictionaryLanguageIds.includes(langId), true);
					
					if (BDFDB.LibraryModules.SpellCheckStore && BDFDB.LibraryModules.SpellCheckStore.isEnabled()) BDFDB.LibraryModules.DispatchApiUtils.dispatch({type: "SPELLCHECK_TOGGLE"});

					BDFDB.PatchUtils.forceAllUpdates(this);
					
					for (let key in this.settings.choices) {
						if (key == "dictionaryLanguage" && !languages[this.settings.choices[key]]) {
							this.settings.choices[key] = "en";
							BDFDB.DataUtils.save(this.settings.choices[key], this, "choices", key);
						}
						this.setDictionary(key, this.settings.choices[key]);
					}
				});
			}
			
			onStop () {
				BDFDB.PatchUtils.forceAllUpdates(this);
				
				BDFDB.DOMUtils.remove(BDFDB.dotCN._spellcheckoverlay);

				for (let key in languageToasts) languageToasts[key] && languageToasts[key].close();
			}

			getSettingsPanel (collapseStates = {}) {
				let ownDictionary = BDFDB.DataUtils.load(this, "owndics", this.settings.choices.dictionaryLanguage) || [];
				
				let settingsPanel;
				return settingsPanel = BDFDB.PluginUtils.createSettingsPanel(this, {
					collapseStates: collapseStates,
					children: _ => {
						let settingsItems = [];
				
						for (let key in this.defaults.general) settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
							className: BDFDB.disCN.marginbottom8,
							type: "Switch",
							plugin: this,
							keys: ["general", key],
							label: this.defaults.general[key].description,
							value: this.settings.general[key]
						}));
						
						for (let key in this.defaults.choices) settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
							className: BDFDB.disCN.marginbottom8,
							type: "Select",
							plugin: this,
							keys: ["choices", key],
							label: this.defaults.choices[key].description,
							basis: "70%",
							value: this.settings.choices[key],
							options: (this.defaults.choices[key].force ? [] : [{value: "-", label: BDFDB.LanguageUtils.LanguageStrings.FORM_LABEL_NOTHING}]).concat(BDFDB.ObjectUtils.toArray(BDFDB.ObjectUtils.map(languages, (lang, id) => ({value: id, label: this.getLanguageName(lang)})))),
							searchable: true,
							onChange: value => {
								this.setDictionary(key, value);
								BDFDB.PluginUtils.refreshSettingsPanel(this, settingsPanel);
							}
						}));
						
						for (let key in this.defaults.amounts) settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
							className: BDFDB.disCN.marginbottom8,
							type: "TextInput",
							childProps: {
								type: "number"
							},
							plugin: this,
							keys: ["amounts", key],
							label: this.defaults.amounts[key].description,
							basis: "20%",
							min: this.defaults.amounts[key].min,
							max: this.defaults.amounts[key].max,
							value: this.settings.amounts[key]
						}));
						
						if (ownDictionary.length) settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsPanelList, {
							title: "Your own Dictionary:",
							children: ownDictionary.map(word => BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Card, {
								children: word.toLowerCase(),
								onRemove: _ => {
									BDFDB.ArrayUtils.remove(ownDictionary, word);
									BDFDB.DataUtils.save(ownDictionary, this, "owndics", this.settings.choices.dictionaryLanguage);
									dictionaries.dictionaryLanguage = this.formatDictionary(langDictionaries.dictionaryLanguage.concat(ownDictionary));
									BDFDB.PluginUtils.refreshSettingsPanel(this, settingsPanel);
								}
							}))
						}));
						
						return settingsItems;
					}
				});
			}

			onSettingsClosed () {
				if (this.SettingsUpdated) {
					delete this.SettingsUpdated;
					BDFDB.PatchUtils.forceAllUpdates(this);
				}
			}

			onSlateContextMenu (e) {
				let [removeParent, removeIndex] = BDFDB.ContextMenuUtils.findItem(e.returnvalue, {id: "spellcheck", group: true});
				if (removeIndex > -1) removeParent.splice(removeIndex, 1);
				[removeParent, removeIndex] = BDFDB.ContextMenuUtils.findItem(e.returnvalue, {id: "correction-0", group: true});
				if (removeIndex > -1) removeParent.splice(removeIndex, 1);
				let textarea = BDFDB.DOMUtils.getParent(BDFDB.dotCN.textarea, e.instance.props.target), word = null;
				if (textarea) for (let error of textarea.parentElement.querySelectorAll(BDFDB.dotCN._spellcheckerror)) {
					let rects = BDFDB.DOMUtils.getRects(error);
					let position = BDFDB.ListenerUtils.getPosition();
					if (position.pageX > rects.x && position.pageX < (rects.x + rects.width) && position.pageY > rects.y && position.pageY < (rects.y + rects.height)) {
						word = error.innerText;
						break;
					}
				}
				if (word && this.isWordNotInDictionary(word)) {
					let similarWords = this.getSimilarWords(word.toLowerCase().trim());
					let [children, index] = BDFDB.ContextMenuUtils.findItem(e.returnvalue, {id: "devmode-copy-id", group: true});
					children.splice(index > -1 ? index : children.length, 0, BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuGroup, {
						children: BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
							label: BDFDB.LanguageUtils.LanguageStrings.SPELLCHECK,
							id: BDFDB.ContextMenuUtils.createItemId(this.name, "spellcheck"),
							children: [
								BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
									label: this.labels.context_spellcheck,
									id: BDFDB.ContextMenuUtils.createItemId(this.name, "add-to-spellcheck"),
									hint: _ => BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.MenuItems.MenuHint, {
										hint: word
									}),
									action: _ => this.addToOwnDictionary(word)
								}),
								BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuSeparator, {}),
								!similarWords.length ? BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
									label: this.labels.context_nosimilarwords,
									id: BDFDB.ContextMenuUtils.createItemId(this.name, "no-suggestions"),
									disabled: true
								}) : similarWords.sort().map(suggestion => BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
									label: suggestion,
									id: BDFDB.ContextMenuUtils.createItemId(this.name, "suggestion", suggestion),
									action: _ => this.replaceWord(e.instance.props.editor, word, suggestion)
								}))
							].flat(10).filter(n => n)
						})
					}));
				}
			}

			processChannelEditorContainer (e) {
				let newText = BDFDB.SlateUtils.toTextValue(e.instance.props.richValue);
				if (newText != currentText) {
					currentText = newText;
					BDFDB.DOMUtils.remove(e.node.parentElement.querySelectorAll(BDFDB.dotCN._spellcheckoverlay));
					BDFDB.TimeUtils.clear(checkTimeout);
					checkTimeout = BDFDB.TimeUtils.timeout(_ => {
						let overlay = e.node.cloneNode(true), wrapper = BDFDB.DOMUtils.getParent(BDFDB.dotCN.textareainner, e.node);
						BDFDB.DOMUtils.addClass(overlay, BDFDB.disCN._spellcheckoverlay);
						let style = Object.assign({}, getComputedStyle(e.node));
						for (let i in style) if (i.indexOf("webkit") == -1 && isNaN(parseInt(i))) overlay.style[i] = style[i];
						overlay.style.setProperty("color", "transparent", "important");
						overlay.style.setProperty("background", "none", "important");
						overlay.style.setProperty("mask", "none", "important");
						overlay.style.setProperty("pointer-events", "none", "important");
						overlay.style.setProperty("position", "absolute", "important");
						overlay.style.setProperty("left", BDFDB.DOMUtils.getRects(e.node).left - BDFDB.DOMUtils.getRects(wrapper).left + "px", "important");
						overlay.style.setProperty("width", BDFDB.DOMUtils.getRects(e.node).width - style.paddingLeft - style.paddingRight + "px", "important");
						overlay.style.setProperty("height", style.height, "important");
						for (let child of overlay.querySelectorAll("*")) {
							child.style.setProperty("color", "transparent", "important");
							child.style.setProperty("background-color", "transparent", "important");
							child.style.setProperty("border-color", "transparent", "important");
							child.style.setProperty("text-shadow", "none", "important");
							child.style.setProperty("object-position", "-999999px -999999px", "important");
							child.style.setProperty("pointer-events", "none", "important");
							if (child.getAttribute("data-slate-string") && child.parentElement.getAttribute("data-slate-leaf")) {
								let newline = child.querySelector("br");
								if (newline) newline.remove();
								child.innerHTML = this.spellCheckText(child.textContent);
								if (newline) child.appendChild(newline);
							}
						}
						e.node.parentElement.appendChild(overlay);
					}, 300);
				}
			}

			spellCheckText (string) {
				let htmlString = [];
				let splitter = "!?!?!?!?!?!?!?!" + this.name + BDFDB.NumberUtils.generateId() + this.name + "!?!?!?!?!?!?!?!";
				string.replace(/([0-9\ \@\>\<\|\,\;\.\:\-\_\=\#\+\*\~\[\]\(\)\{\}\\\/\&\^\t\r\n])/g, "$1" + splitter).split(splitter).forEach(word => {
					let execReturn = /[0-9\ \@\>\<\|\,\;\.\:\-\_\=\#\+\*\~\[\]\(\)\{\}\\\/\&\^\t\r\n]$/g.exec(word);
					if (execReturn) word = word.slice(0, execReturn[0].length * -1);
					htmlString.push(`<span class="${this.isWordNotInDictionary(word) ? BDFDB.disCN._spellcheckerror : ""}" style="color: transparent !important; text-shadow: none !important;">${BDFDB.StringUtils.htmlEscape(word)}</span>`);
					if (execReturn) htmlString.push(`<span>${execReturn[0]}</span>`);
				});
				return htmlString.join("").replace(/\n /g, "\n");
			}

			replaceWord (editor, toBeReplaced, replacement) {
				if (!editor) return;
				toBeReplaced = toBeReplaced.toUpperCase();
				let newString = [];
				let splitter = "!?!?!?!?!?!?!?!" + this.name + BDFDB.NumberUtils.generateId() + this.name + "!?!?!?!?!?!?!?!";
				BDFDB.SlateUtils.toTextValue(editor.children).replace(/([0-9\ \@\>\<\|\,\;\.\:\-\_\=\#\+\*\~\[\]\(\)\{\}\\\/\&\^\t\r\n])/g, "$1" + splitter).split(splitter).forEach(word => {
					let execReturn = /[0-9\ \@\>\<\|\,\;\.\:\-\_\=\#\+\*\~\[\]\(\)\{\}\\\/\&\^\t\r\n]$/g.exec(word);
					if (execReturn) word = word.slice(0, execReturn[0].length * -1);
					if (word.toUpperCase() == toBeReplaced) {
						let firstLetter = word.charAt(0);
						let isCapitalised = firstLetter.toUpperCase() == firstLetter && firstLetter.toLowerCase() != firstLetter;
						newString.push(isCapitalised ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement);
					}
					else newString.push(word);
					if (execReturn) newString.push(execReturn[0]);
				});
				editor.history.stack.splice(editor.history.index + 1, 0, {
					type: "other",
    				mergeable: false,
    				createdAt: new Date().getTime(),
    				value: BDFDB.SlateUtils.toRichValue(newString.join("")),
					selection: editor.history.stack[editor.history.index].selection
				});
				editor.redo();
			}

			addToOwnDictionary (word) {
				word = word.split(" ")[0].split("\n")[0].split("\r")[0].split("\t")[0];
				if (word) {
					let wordLow = word.toLowerCase();
					if (languages[this.settings.choices.dictionaryLanguage]) {
						let ownDictionary = BDFDB.DataUtils.load(this, "owndics", this.settings.choices.dictionaryLanguage) || [];
						if (!ownDictionary.includes(wordLow)) {
							ownDictionary.push(wordLow);
							BDFDB.DataUtils.save(ownDictionary, this, "owndics", this.settings.choices.dictionaryLanguage);
							BDFDB.NotificationUtils.toast(this.labels.toast_wordadd.replace("{{var0}}", word).replace("{{var1}}", this.getLanguageName(languages[this.settings.choices.dictionaryLanguage])), {type: "success"});
							dictionaries.dictionaryLanguage = this.formatDictionary(langDictionaries.dictionaryLanguage.concat(ownDictionary));
						}
					}
				}
			}

			setDictionary (key, lang) {
				languageToasts[key] && languageToasts[key].close();
				if (languages[lang]) {
					let ownDictionary = BDFDB.DataUtils.load(this, "owndics", lang) || [];
					languageToasts[key] = BDFDB.NotificationUtils.toast(`${this.labels.toast_dictionary.replace("{{var0}}", this.getLanguageName(languages[lang]))} - ${BDFDB.LanguageUtils.LibraryStrings.please_wait}`, {timeout: 0, ellipsis: true, position: "center"});
					languageToasts[key].lang = lang
					
					const folder = BDFDB.LibraryRequires.path.join(BDFDB.BDUtils.getPluginsFolder(), "dictionaries");
					const filePath = BDFDB.LibraryRequires.path.join(folder, lang + ".dic");
					
					const parse = (error, response, body, download) => {
						languageToasts[key].close();
						if (error || (response && body.toLowerCase().indexOf("<!doctype html>") > -1)) {
							BDFDB.NotificationUtils.toast(this.labels.toast_dictionary_fail.replace("{{var0}}", this.getLanguageName(languages[lang])), {
								type: "danger",
								position: "center"
							});
						}
						else if (response && languageToasts[key].lang == lang) {
							if (download) {
								if (!BDFDB.LibraryRequires.fs.existsSync(folder)) BDFDB.LibraryRequires.fs.mkdirSync(folder);
								BDFDB.LibraryRequires.fs.writeFile(filePath, body, _ => {});
							}
							langDictionaries[key] = body.toLowerCase().replace(/\r/g, "").replace(/\s/g, "\n").split("\n");
							dictionaries[key] = this.formatDictionary(langDictionaries[key].concat(ownDictionary));
							BDFDB.NotificationUtils.toast(this.labels.toast_dictionary_success.replace("{{var0}}", this.getLanguageName(languages[lang])), {
								type: "success",
								position: "center"
							});
						}
					};
					
					if (this.settings.general.downloadDictionary && BDFDB.LibraryRequires.fs.existsSync(filePath)) BDFDB.LibraryRequires.fs.readFile(filePath, (error, buffer) => {
						parse(error, buffer, buffer.toString(), false);
					});
					else BDFDB.LibraryRequires.request("https://mwittrien.github.io/BetterDiscordAddons/Plugins/SpellCheck/dic/" + lang + ".dic", (error, response, body) => {
						parse(error, response, body, this.settings.general.downloadDictionary);
					});
				}
				else {
					delete dictionaries[key];
					delete langDictionaries[key];
				}
			}
			
			formatDictionary (words) {
				let i = 0;
				return words.reduce((dictionary, word) => {
					let firstLetterLower = word.charAt(0).toLowerCase();
					if (!dictionary[firstLetterLower]) dictionary[firstLetterLower] = {};
					if (!dictionary[firstLetterLower][word.length]) dictionary[firstLetterLower][word.length] = [];
					dictionary[firstLetterLower][word.length].push(word);
					return dictionary;
				}, {});
			}

			isWordNotInDictionary (unformatedWord) {
				let wordLow = unformatedWord.toLowerCase();
				let wordWithoutSymbols = wordLow.replace(/[0-9\??\@\$\??\???\??\??\??\??\>\<\|\,\;\.\:\-\_\#\+\*\~\?\??\\\??\`\???\???\???\???\}\=\]\)\[\(\{\/\&\%\??\"\!\??\^\??\n\t\r]/g, "");
				if (wordLow.indexOf("http://") != 0 && wordLow.indexOf("https://") != 0 && wordWithoutSymbols && wordWithoutSymbols.length > wordLow.length/2) {
					let wordStartingPos = /^.{1}'/.test(wordWithoutSymbols) ? wordWithoutSymbols.split("'")[1] : "";
					let wordEndingPos = /'.{1}$/.test(wordWithoutSymbols) ? wordWithoutSymbols.split("'").reverse()[1] : "";
					for (let key in dictionaries) for (let word of BDFDB.ArrayUtils.removeCopies([wordLow, wordWithoutSymbols, wordStartingPos, wordEndingPos].filter(n => n))) {
						let firstLetterLower = word.charAt(0);
						if (dictionaries[key] && dictionaries[key][firstLetterLower] && dictionaries[key][firstLetterLower][word.length] && dictionaries[key][firstLetterLower][word.length].includes(word)) return false;
					}
					return true;
				}
				return false;
			}

			getSimilarWords (word) {
				let similarWords = [];
				if (this.settings.amounts.maxSimilarAmount > 0) {
					let firstLetterLower = word.charAt(0).toLowerCase();
					let possibilities = [];
					for (let key in dictionaries) if (dictionaries[key] && dictionaries[key][firstLetterLower]) possibilities = possibilities.concat(BDFDB.ObjectUtils.toArray(dictionaries[key][firstLetterLower]).flat());
					possibilities = BDFDB.ArrayUtils.removeCopies(possibilities);
					let similarities = {};
					for (let string of possibilities) {
						let value = this.wordSimilarity(word, string);
						if (!similarities[value]) similarities[value] = [];
						similarities[value].push(string);
					}
					let amount = 0;
					for (let value of Object.keys(similarities).sort().reverse()) {
						for (let similarWord of similarities[value]) {
							if (amount < this.settings.amounts.maxSimilarAmount && !similarWords.includes(similarWord)) {
								similarWords.push(similarWord);
								amount++;
							}
							if (amount >= this.settings.amounts.maxSimilarAmount) break;
						}
						if (amount >= this.settings.amounts.maxSimilarAmount) break;
					}
				}
				return similarWords;
			}

			wordSimilarity (a, b) {
				let temp;
				if (a.length === 0 || b.length === 0 || a.length - b.length > 3 || b.length - a.length > 3) return 0;
				if (a.length > b.length) {
					temp = a;
					a = b;
					b = temp;
				}
				let result = 0, row = [...Array(a.length + 1).keys()];
				for (let i = 1; i <= b.length; i++) {
					result = i;
					for (let j = 1; j <= a.length; j++) {
						temp = row[j - 1];
						row[j - 1] = result;
						result = b[i - 1] === a[j - 1] ? temp : Math.min(temp + 1, Math.min(result + 1, row[j] + 1));
					}
				}
				return (b.length - result) / b.length;
			}
			
			getLanguageName (language) {
				if (language.name.startsWith("Discord")) return language.name.slice(0, -1) + (language.ownlang && languages[language.id].name != language.ownlang ? ` / ${language.ownlang}` : "") + ")";
				else return language.name + (language.ownlang && language.name != language.ownlang ? ` / ${language.ownlang}` : "");
			}

			setLabelsByLanguage () {
				switch (BDFDB.LanguageUtils.getLanguage().id) {
					case "bg":		// Bulgarian
						return {
							context_nosimilarwords:				"???????? ?????????????? ????????",
							context_spellcheck:					"???????????????? ?????? ??????????????",
							toast_dictionary:					"???????? ???? ?????????????????? ???? ???????????? ({{var0}})",
							toast_dictionary_fail:				"?????????????????????? ???? ?????????????? ???? ???? ?????????????? ({{var0}})",
							toast_dictionary_success:			"???????????? ({{var0}}) ?? ???????????????? ??????????????",
							toast_wordadd:						"???????????? '{{var0}}' ?? ???????????????? ?????? ?????????????? ({{var1}})"
						};
					case "da":		// Danish
						return {
							context_nosimilarwords:				"Ingen lignende ord",
							context_spellcheck:					"F??j til ordbog",
							toast_dictionary:					"Fors??ger at hente ordbog ({{var0}})",
							toast_dictionary_fail:				"Ordbogen ({{var0}}) kunne ikke hentes",
							toast_dictionary_success:			"Ordbogen ({{var0}}) hentet med succes",
							toast_wordadd:						"Ordet '{{var0}}' blev f??jet til ordbogen ({{var1}})"
						};
					case "de":		// German
						return {
							context_nosimilarwords:				"Keine ??hnlichen W??rter",
							context_spellcheck:					"Zum W??rterbuch hinzuf??gen",
							toast_dictionary:					"Versuch, das W??rterbuch abzurufen ({{var0}})",
							toast_dictionary_fail:				"Fehler beim Abrufen des W??rterbuchs ({{var0}})",
							toast_dictionary_success:			"W??rterbuch ({{var0}}) erfolgreich abgerufen",
							toast_wordadd:						"Wort '{{var0}}' zum W??rterbuch ({{var1}}) hinzugef??gt"
						};
					case "el":		// Greek
						return {
							context_nosimilarwords:				"?????? ???????????????? ?????????????????? ????????????",
							context_spellcheck:					"???????????????? ?????? ????????????",
							toast_dictionary:					"???????????????????? ?????????? ?????????????? ({{var0}})",
							toast_dictionary_fail:				"???????????????? ?????????????????? ?????????????? ({{var0}})",
							toast_dictionary_success:			"???? ???????????? ({{var0}}) ???????????????????? ???? ????????????????",
							toast_wordadd:						"???????????????????? ?? ???????? '{{var0}}' ?????? ???????????? ({{var1}})"
						};
					case "es":		// Spanish
						return {
							context_nosimilarwords:				"No hay palabras similares",
							context_spellcheck:					"Agregar al diccionario",
							toast_dictionary:					"Intentando obtener el diccionario ({{var0}})",
							toast_dictionary_fail:				"No se pudo recuperar el diccionario ({{var0}})",
							toast_dictionary_success:			"Diccionario ({{var0}}) obtenido correctamente",
							toast_wordadd:						"Se agreg?? la palabra '{{var0}}' al diccionario ({{var1}})"
						};
					case "fi":		// Finnish
						return {
							context_nosimilarwords:				"Ei vastaavia sanoja",
							context_spellcheck:					"Lis???? sanakirjaan",
							toast_dictionary:					"Sanaa yritet????n noutaa ({{var0}})",
							toast_dictionary_fail:				"Sanakirjan noutaminen ep??onnistui ({{var0}})",
							toast_dictionary_success:			"Sanakirjan ({{var0}}) haku onnistui",
							toast_wordadd:						"Sana '{{var0}}' lis??ttiin sanakirjaan ({{var1}})"
						};
					case "fr":		// French
						return {
							context_nosimilarwords:				"Pas de mots similaires",
							context_spellcheck:					"Ajouter au dictionnaire",
							toast_dictionary:					"Tentative de r??cup??ration du dictionnaire ({{var0}})",
							toast_dictionary_fail:				"??chec de la r??cup??ration du dictionnaire ({{var0}})",
							toast_dictionary_success:			"Le dictionnaire ({{var0}}) a bien ??t?? r??cup??r??",
							toast_wordadd:						"Mot '{{var0}}' ajout?? au dictionnaire ({{var1}})"
						};
					case "hr":		// Croatian
						return {
							context_nosimilarwords:				"Nema sli??nih rije??i",
							context_spellcheck:					"Dodaj u rje??nik",
							toast_dictionary:					"Poku??aj dohva??anja Rje??nika ({{var0}})",
							toast_dictionary_fail:				"Dohva??anje Rje??nika nije uspjelo ({{var0}})",
							toast_dictionary_success:			"Rje??nik ({{var0}}) je uspje??no dohva??en",
							toast_wordadd:						"Rije?? '{{var0}}' dodana je u rje??nik ({{var1}})"
						};
					case "hu":		// Hungarian
						return {
							context_nosimilarwords:				"Nincsenek hasonl?? szavak",
							context_spellcheck:					"Hozz??ad??s a sz??t??rhoz",
							toast_dictionary:					"Sz??t??r lek??r??se pr??b??lkozik ({{var0}})",
							toast_dictionary_fail:				"Nem siker??lt beolvasni a Sz??t??rt ({{var0}})",
							toast_dictionary_success:			"A sz??t??r ({{var0}}) let??lt??se sikeresen megt??rt??nt",
							toast_wordadd:						"A '{{var0}}' sz?? hozz??adva a ({{var1}}) sz??t??rhoz"
						};
					case "it":		// Italian
						return {
							context_nosimilarwords:				"Nessuna parola simile",
							context_spellcheck:					"Aggiungi al dizionario",
							toast_dictionary:					"Tentativo di recupero del dizionario ({{var0}})",
							toast_dictionary_fail:				"Impossibile recuperare il dizionario ({{var0}})",
							toast_dictionary_success:			"Dizionario ({{var0}}) recuperato correttamente",
							toast_wordadd:						"Parola '{{var0}}' aggiunta al dizionario ({{var1}})"
						};
					case "ja":		// Japanese
						return {
							context_nosimilarwords:				"?????????????????????????????????",
							context_spellcheck:					"???????????????",
							toast_dictionary:					"?????????????????????????????????????????? ???{{var0}}??? ",
							toast_dictionary_fail:				"???????????????????????????????????? ???{{var0}}??? ",
							toast_dictionary_success:			"?????? ???{{var0}}??? ???????????????????????????????????????",
							toast_wordadd:						"?????? '{{var0}}' ????????? ({{var1}}) ????????????????????????"
						};
					case "ko":		// Korean
						return {
							context_nosimilarwords:				"????????? ?????? ??????",
							context_spellcheck:					"????????? ??????",
							toast_dictionary:					"?????? ({{var0}}) ??? ?????? ?????? ???",
							toast_dictionary_fail:				"?????? ({{var0}}) ??? ?????? ?????? ???????????????.",
							toast_dictionary_success:			"?????? ({{var0}}) ??? ??????????????? ?????? ????????????.",
							toast_wordadd:						"??????  '{{var0}}' ??? ({{var1}}) ????????? ?????????????????????"
						};
					case "lt":		// Lithuanian
						return {
							context_nosimilarwords:				"Joki?? pana??i?? ??od??i??",
							context_spellcheck:					"Prid??ti prie ??odyno",
							toast_dictionary:					"Bandoma gauti ??odyn?? ({{var0}})",
							toast_dictionary_fail:				"Nepavyko gauti ??odyno ({{var0}})",
							toast_dictionary_success:			"??odynas ({{var0}}) s??kmingai gautas",
							toast_wordadd:						"??odis '{{var0}}' prid??tas prie ??odyno ({{var1}})"
						};
					case "nl":		// Dutch
						return {
							context_nosimilarwords:				"Geen vergelijkbare woorden",
							context_spellcheck:					"Toevoegen aan woordenboek",
							toast_dictionary:					"Probeert woordenboek op te halen ({{var0}})",
							toast_dictionary_fail:				"Ophalen van woordenboek ({{var0}}) is mislukt",
							toast_dictionary_success:			"Woordenboek ({{var0}}) succesvol opgehaald",
							toast_wordadd:						"Woord '{{var0}}' toegevoegd aan woordenboek ({{var1}})"
						};
					case "no":		// Norwegian
						return {
							context_nosimilarwords:				"Ingen lignende ord",
							context_spellcheck:					"Legg til ordbok",
							toast_dictionary:					"Pr??ver ?? hente ordbok ({{var0}})",
							toast_dictionary_fail:				"Kunne ikke hente ordboken ({{var0}})",
							toast_dictionary_success:			"Ordbok ({{var0}}) hentet",
							toast_wordadd:						"Ordet '{{var0}}' ble lagt til ordboken ({{var1}})"
						};
					case "pl":		// Polish
						return {
							context_nosimilarwords:				"Brak podobnych s????w",
							context_spellcheck:					"Dodaj do s??ownika",
							toast_dictionary:					"Pr??ba pobrania s??ownika ({{var0}})",
							toast_dictionary_fail:				"Nie uda??o si?? pobra?? s??ownika ({{var0}})",
							toast_dictionary_success:			"S??ownik ({{var0}}) zosta?? pobrany pomy??lnie",
							toast_wordadd:						"S??owo '{{var0}}' zosta??o dodane do s??ownika ({{var1}})"
						};
					case "pt-BR":	// Portuguese (Brazil)
						return {
							context_nosimilarwords:				"Sem palavras semelhantes",
							context_spellcheck:					"Adicionar ao Dicion??rio",
							toast_dictionary:					"Tentando obter Dicion??rio ({{var0}})",
							toast_dictionary_fail:				"Falha ao buscar dicion??rio ({{var0}})",
							toast_dictionary_success:			"Dicion??rio ({{var0}}) obtido com sucesso",
							toast_wordadd:						"Palavra '{{var0}}' adicionada ao dicion??rio ({{var1}})"
						};
					case "ro":		// Romanian
						return {
							context_nosimilarwords:				"F??r?? cuvinte similare",
							context_spellcheck:					"Ad??uga??i la dic??ionar",
							toast_dictionary:					"??ncercarea de a prelua dic??ionar ({{var0}})",
							toast_dictionary_fail:				"Eroare la preluarea dic??ionarului ({{var0}})",
							toast_dictionary_success:			"Dic??ionarul ({{var0}}) a fost preluat cu succes",
							toast_wordadd:						"Cuv??ntul '{{var0}}' a fost ad??ugat ??n dic??ionar ({{var1}})"
						};
					case "ru":		// Russian
						return {
							context_nosimilarwords:				"?????? ?????????????? ????????",
							context_spellcheck:					"???????????????? ?? ??????????????",
							toast_dictionary:					"?????????????? ???????????????? ?????????????? ({{var0}})",
							toast_dictionary_fail:				"???? ?????????????? ???????????????? ?????????????? ({{var0}})",
							toast_dictionary_success:			"?????????????? ({{var0}}) ?????????????? ??????????????",
							toast_wordadd:						"?????????? '{{var0}}' ?????????????????? ?? ?????????????? ({{var1}})"
						};
					case "sv":		// Swedish
						return {
							context_nosimilarwords:				"Inga liknande ord",
							context_spellcheck:					"L??gg till ordbok",
							toast_dictionary:					"F??rs??ker h??mta ordbok ({{var0}})",
							toast_dictionary_fail:				"Det gick inte att h??mta ordboken ({{var0}})",
							toast_dictionary_success:			"Ordbok ({{var0}}) h??mtades framg??ngsrikt",
							toast_wordadd:						"Ordet '{{var0}}' har lagts till i ordboken ({{var1}})"
						};
					case "th":		// Thai
						return {
							context_nosimilarwords:				"??????????????????????????????????????????????????????",
							context_spellcheck:					"????????????????????????????????????????????????",
							toast_dictionary:					"????????????????????????????????????????????????????????????????????? ({{var0}})",
							toast_dictionary_fail:				"??????????????????????????????????????????????????????????????? ({{var0}})",
							toast_dictionary_success:			"???????????????????????????????????? ({{var0}}) ??????????????????",
							toast_wordadd:						"????????????????????? '{{var0}}' ????????????????????????????????? ({{var1}}) ????????????"
						};
					case "tr":		// Turkish
						return {
							context_nosimilarwords:				"Benzer kelime yok",
							context_spellcheck:					"S??zl????e Ekle",
							toast_dictionary:					"S??zl??k ({{var0}}) getirilmeye ??al??????l??yor",
							toast_dictionary_fail:				"S??zl??k ({{var0}}) getirilemedi",
							toast_dictionary_success:			"S??zl??k ({{var0}}) ba??ar??yla getirildi",
							toast_wordadd:						"'{{var0}}' kelimesi, ({{var1}}) s??zl??????ne eklendi"
						};
					case "uk":		// Ukrainian
						return {
							context_nosimilarwords:				"?????????? ???????????????? ????????",
							context_spellcheck:					"???????????? ???? ????????????????",
							toast_dictionary:					"???????????? ???????????????? ?????????????? ({{var0}})",
							toast_dictionary_fail:				"???? ?????????????? ???????????????? ?????????????? ({{var0}})",
							toast_dictionary_success:			"?????????????? ({{var0}}) ???????????????? ??????????????",
							toast_wordadd:						"?????????? '{{var0}}' ???????????? ???? ???????????????? ({{var1}})"
						};
					case "vi":		// Vietnamese
						return {
							context_nosimilarwords:				"Kh??ng c?? t??? t????ng t???",
							context_spellcheck:					"Th??m v??o t??? ??i???n",
							toast_dictionary:					"??ang c??? g???ng t??m n???p T??? ??i???n ({{var0}})",
							toast_dictionary_fail:				"Kh??ng t??m n???p ???????c T??? ??i???n ({{var0}})",
							toast_dictionary_success:			"T??? ??i???n ({{var0}}) ???????c t??m n???p th??nh c??ng",
							toast_wordadd:						"???? th??m t??? '{{var0}}' v??o t??? ??i???n ({{var1}})"
						};
					case "zh-CN":	// Chinese (China)
						return {
							context_nosimilarwords:				"??????????????????",
							context_spellcheck:					"???????????????",
							toast_dictionary:					"?????????????????? ???{{var0}}??? ",
							toast_dictionary_fail:				"?????????????????? ???{{var0}}??? ",
							toast_dictionary_success:			"????????????????????? ???{{var0}}??? ",
							toast_wordadd:						"????????? '{{var0}}' ??????????????? ({{var1}}) ???"
						};
					case "zh-TW":	// Chinese (Taiwan)
						return {
							context_nosimilarwords:				"??????????????????",
							context_spellcheck:					"???????????????",
							toast_dictionary:					"?????????????????? ???{{var0}}??? ",
							toast_dictionary_fail:				"?????????????????? ???{{var0}}??? ",
							toast_dictionary_success:			"????????????????????? ???{{var0}}??? ",
							toast_wordadd:						"????????? '{{var0}}' ??????????????? ({{var1}}) ???"
						};
					default:		// English
						return {
							context_nosimilarwords:				"No similar Words",
							context_spellcheck:					"Add to Dictionary",
							toast_dictionary:					"Trying to fetch Dictionary ({{var0}})",
							toast_dictionary_fail:				"Failed to fetch Dictionary ({{var0}})",
							toast_dictionary_success:			"Dictionary ({{var0}}) fetched successfully",
							toast_wordadd:						"Word '{{var0}}' added to Dictionary ({{var1}})"
						};
				}
			}
		};
	})(window.BDFDB_Global.PluginUtils.buildPlugin(changeLog));
})();
