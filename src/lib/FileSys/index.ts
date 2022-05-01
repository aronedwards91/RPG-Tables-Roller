import stringData from './defaultData';

var fs = undefined;
if (typeof window !== undefined) {
	fs = window.__TAURI__.fs;
}
const TauriDocumentKey = 'Document';
const rootFolder = 'Fantasy-Tables';
const collectionsFolder = 'Collections';
const projectsFolder = 'Projects';
const readmePath = '/README.txt';
const castlesIndex = '/Collections/castle';
const namesIndex = '/Collections/names';

function waitforme(milisec) {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve('');
		}, milisec);
	});
}

export default {
	setup: async (): Promise<void> => {
		if (typeof window !== undefined) {
			fs = window.__TAURI__.fs;
			return;
		}
		let windowSet = false;
		while (!windowSet) {
			if (typeof window !== undefined) {
				fs = window.__TAURI__.fs;
				return;
			} else {
				await waitforme(500);
				windowSet = true;
			}
		}
	},
	initRootFiles: async (): Promise<void> => {
		return new Promise((resolve, reject) => {
			(async () => {
				const fileChecks = Promise.all([
					fs
						.readTextFile(rootFolder + readmePath, {
							dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
						})
						.then(
							function hasFolder() {
								return true;
							},
							function folderMissing() {
								return false;
							}
						),
					fs
						.readDir(rootFolder + '/' + collectionsFolder, {
							dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
						})
						.then(
							function hasFolder() {
								return true;
							},
							function folderMissing() {
								return false;
							}
						),
					fs
						.readDir(rootFolder + '/' + projectsFolder, {
							dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
						})
						.then(
							function hasFolder() {
								return true;
							},
							function folderMissing() {
								return false;
							}
						)
				]);
				const fileCheckResults = await fileChecks;
				// Check missing readme & collections folder and add if not yet created
				const ReadMeExists = fileCheckResults[0];
				const CollectionsExists = fileCheckResults[1];
				const projectsExists = fileCheckResults[2];
				const fixDirectory = Promise.all([
					ReadMeExists ||
						fs
							.writeFile(
								{
									path: rootFolder + readmePath,
									contents: stringData.Readme
								},
								{
									dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
								}
							)
							.then(
								function createdReadme() {
									return true;
								},
								function createReadmeFailed() {
									return false;
								}
							),
					CollectionsExists ||
						fs
							.createDir(rootFolder + '/' + collectionsFolder, {
								dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
							})
							.then(
								function createdCollections(result) {
									return true;
								},
								function createCollectionsFailed() {
									return false;
								}
							),
					projectsExists ||
						fs
							.createDir(rootFolder + '/' + projectsFolder, {
								dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
							})
							.then(
								function createdCollections() {
									return true;
								},
								function createCollectionsFailed() {
									return false;
								}
							)
				]);
				await fixDirectory;
				if (CollectionsExists === false) {
					// If no collections folder add in some example data
					await fs.createDir(rootFolder + castlesIndex, {
						dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
					});
					await fs.writeFile(
						{
							path: rootFolder + castlesIndex + '/index.json',
							contents: stringData.castlesIndex
						},
						{
							dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
						}
					);
					await fs.writeFile(
						{
							path: rootFolder + castlesIndex + '/castle.json',
							contents: stringData.castlesMain
						},
						{
							dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
						}
					);

					await fs.writeFile(
						{
							path: rootFolder + castlesIndex + '/castle-japan.json',
							contents: stringData.castlesJapan
						},
						{
							dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
						}
					);

					await fs.createDir(rootFolder + namesIndex, {
						dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
					});
					await fs.writeFile(
						{
							path: rootFolder + namesIndex + '/index.json',
							contents: stringData.namesIndex
						},
						{
							dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
						}
					);
					await fs.writeFile(
						{
							path: rootFolder + namesIndex + stringData.placesFolder,
							contents: stringData.namesPlaces
						},
						{
							dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
						}
					);
				}
				resolve();
			})();
		});
	},
	initRootDir: async (): Promise<void> => {
		return new Promise(async (resolve, reject) => {
			let roorDir = false;
			try {
				roorDir = await fs.readDir(rootFolder, {
					dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
				});
			} catch (e) {
				console.error(e);
			}
			if (!roorDir) {
				await fs.createDir(rootFolder, {
					dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
				});
			}
			resolve();
		});
	},
	getCollections: async (): Promise<FileEntry[]> => {
		return new Promise((resolve, reject) => {
			fs.readDir(rootFolder + '/' + collectionsFolder, {
				dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
			}).then(
				function (result) {
					resolve(result);
				},
				function () {
					reject([]);
				}
			);
		});
	},
	getCollectionIndex: async (collectionPath: string): Promise<tableIndex> => {
		return new Promise((resolve, reject) => {
			fs.readTextFile(collectionPath + '/index.json')
				.then(
					function (result) {
						const indexAsObject = JSON.parse(result);
						indexAsObject.path = collectionPath;
						resolve(indexAsObject);
					},
					function (error) {
						console.error(error);
						reject({ collectionID: null, collectionName: 'error' });
					}
				)
				.catch((err) => {
					console.error('ERR', err);
				});
		});
	},
	getProjectsData: async (): Promise<projList> => {
		return new Promise((resolve, reject) => {
			fs.readDir(rootFolder + '/' + projectsFolder, {
				dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
			})
				.then(
					function folderFiles(result) {
						const projects = [];
						result.forEach((element) => {
							const name = element.name;
							const length = element.name.length;
							if (name.substring(length - 5, length) === '.json') {
								element.name = element.name.replace(".json", "");
								projects.push(element);
							}
						});
						resolve(projects);
					},
					function folderMissing() {
						reject();
					}
				)
				.catch(function (e) {
					console.error(e);
				});
		});
	},
	saveProjectFile: async (fileName: string, fileDataString: string, byPath?: boolean): Promise<boolean> => {
		return new Promise((resolve, reject) => {
			const path = byPath ? fileName : rootFolder + '/' + projectsFolder + '/' + fileName + '.json';
			fs.writeFile(
				{
					path,
					contents: fileDataString
				},
				{
					dir: window.__TAURI__.fs.BaseDirectory[TauriDocumentKey]
				}
			).then(
				() => {
					resolve(true);
				},
				(e) => {
					console.error(e);
					resolve(false);
				}
			);
		});
	},
	getFile: async (path: string): Promise<tableItem> => {
		const length = path.length;
		const append = path.substring(length - 5, length) === '.json' ? '' : '.json';

		return new Promise((resolve, reject) => {
			fs.readTextFile(path + append).then(
				function (result) {
					const tableObject = JSON.parse(result);
					resolve(tableObject);
				},
				function (error) {
					console.error(error);
					reject({ collectionID: null, collectionName: 'error' });
				}
			);
		});
	}
};
