import { STATUS } from '$lib/enums';
import FileSys from '$lib/FileSys/index';
let debug = true;

const stringReturnedValues = 3;
let status = STATUS.UNSTARTED;
let projects: projList;
// let dataMode = DATA_MODE.SLOW;
const callRegex = /\{{(.*?)\}}/g; // finds all text covered by {{example/roll:default}}
const generalIndex = {
	categories: {
		all: {},
		utility: {}
	}
};
const errorResponse = {
	data: [['Error', 'Error building table']],
	call: { collection: '', tablesGroupKey: '', tableName: '' },
	type: 0
};
enum CHOICE_TYPE {
	string = 'string',
	npc = 'npc'
}
async function asyncForEach(array, callback) {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array);
	}
}

async function buildIndexData(): Promise<void> {
	return new Promise((resolve, reject) => {
		(async () => {
			try {
				const collections: FileEntry[] = await FileSys.getCollections();
				if (collections) {
					await collections.forEach(async (element, index) => {
						const tableIndexData: tableIndex = await FileSys.getCollectionIndex(element.path);
						// add to category
						const category = tableIndexData.category.toLowerCase();
						if (category !== 'utility') {
							generalIndex.categories.all[tableIndexData.collectionID] = tableIndexData;
						}
						if (!generalIndex.categories[category]) {
							generalIndex.categories[category] = {};
						}
						generalIndex.categories[category][tableIndexData.collectionID] = tableIndexData;
						generalIndex.categories[category][tableIndexData.collectionID].tablesData = {};
						Object.keys(tableIndexData.tables).forEach(function (key: string) {
							generalIndex.categories[category][tableIndexData.collectionID].tablesData[key] = {
								dataReady: false,
								data: null,
								tablesList: tableIndexData.tables[key]
							};
						});
					});
					if (debug) console.log('generalIndex', generalIndex);
					status = STATUS.BUILT;
					resolve();
				} else {
					console.error('Unable to find files');
					reject();
				}
			} catch (err) {
				console.error('Unable to find files;', err);
				reject(err);
			}
		})();
	});
}
async function checkString(resultString: string): Promise<string> {
	const externalCallFound = resultString.match(callRegex);
	if (debug) console.log('checkString--externalCallFound', externalCallFound);
	if (externalCallFound) {
		function getStringRandom(item) {
			return new Promise((res, rej) => {
				const collectionString = item.substring(2, item.length - 2).split(':');
				const collectionCall = collectionString[0]; // removes {{}} & backup option
				const tableAddress = collectionCall.split('/');
				if (debug) console.log('checkString--tableAddress', tableAddress);

				getRoll(tableAddress[0], tableAddress[1], tableAddress[2], true).then((response) => {
					if (debug) console.log('checkString--getRoll-response', response);
					if (response.utility === '') {
						res(collectionString[1]);
					} else {
						res(response.utility);
					}
				});
			});
		}

		const allCalls = Promise.all(externalCallFound.map(getStringRandom));
		const stringReplacements = await allCalls;
		var iter = 0;
		function myReplace(): string {
			const val = iter;
			iter++;
			return stringReplacements[val] + '';
		}
		if (debug) console.log('stringReplacements', stringReplacements);

		var newString = resultString;
		return newString.replace(callRegex, myReplace);
	} else {
		return resultString;
	}
}

function rollUtility(utility: tableUtilityItem): Promise<string> {
	return new Promise((resolve, reject) => {
		(async () => {
			const choicesAvailable = utility.table.length;
			const randomTable = Math.floor(Math.random() * choicesAvailable);
			const checkedResult = await checkString(utility.table[randomTable]);
			// return checkedResult;
			resolve(checkedResult);
		})();
	});
}
async function rollTable(
	tableSections: tableSection[],
	type: CHOICE_TYPE,
	call: ChoiceCall
): Promise<Choice> {
	// const returnNum = resultsNum || stringReturnedValues;
	return new Promise((resolve, reject) => {
		(async () => {
			try {
				switch (type) {
					case CHOICE_TYPE.string:
						const result = [];
						await asyncForEach(tableSections, async (section) => {
							result.push(section.name);

							const choicesAvailable = section.table.length;
							const randomTable = Math.floor(Math.random() * choicesAvailable);
							const checkedResult = await checkString(section.table[randomTable]);
							result.push(checkedResult);
						});
						resolve({
							type,
							call,
							data: [result]
						});
						break;
					default:
						resolve({
							type: CHOICE_TYPE.string,
							call: errorResponse.call,
							data: [['Error', 'Unable to roll table']]
						});
				}
			} catch (err) {
				reject(err);
			}
		})();
	});
}

async function getRoll(
	collection: string,
	group: string,
	table: string,
	isUtility: boolean = false
): Promise<Choice> {
	if (debug) console.log('getRoll--isUtility', isUtility);
	const call = {
		collection,
		tablesGroupKey: group,
		tableName: table
	};
	if (debug) console.log('getRoll--call', call);
	return new Promise((resolve, reject) => {
		let rootCollection;
		if (isUtility) {
			rootCollection = generalIndex.categories.utility[collection];
		} else {
			rootCollection = generalIndex.categories.all[collection];
		}
		if (debug) console.log('getRoll--rootCollection', rootCollection);
		if (rootCollection) {
			const tableData: indexTableData = rootCollection.tablesData[group] || {
				data: null,
				dataReady: false,
				tableList: null
			};
			if (debug) console.log('getRoll--tableData', tableData);

			const build = () => {
				if (isUtility) {
					rollUtility(tableData.data[table])
						.then((rollResult) => {
							if (debug) console.log('rollUtility-res', rollResult);
							resolve({
								utility: rollResult,
								type: CHOICE_TYPE.string,
								call
							});
						})
						.catch((err) => console.error(err));
				} else {
					rollTable(tableData.data[table].tableSections, CHOICE_TYPE.string, call).then(
						(rollData) => {
							if (debug) console.log('rollData', rollData);
							resolve(rollData);
						}
					);
				}
			};
			if (tableData.dataReady) {
				build();
			} else {
				FileSys.getFile(rootCollection.path + '/' + group).then(function (tableJSON) {
					tableData.data = tableJSON;
					tableData.dataReady = true;

					build();
				});
			}
		} else {
			if (debug) console.log('getRoll--root collection not found');
			if (isUtility) {
				resolve({
					utility: '',
					type: CHOICE_TYPE.string,
					call
				});
			} else {
				resolve(errorResponse);
			}
		}
	});
}
async function getRollWithCall(call: ChoiceCall, isUtility: boolean) {
	return getRoll(call.collection, call.tablesGroupKey, call.tableName, isUtility);
}

async function iniateBuild(): Promise<STATUS> {
	await FileSys.setup();
	return new Promise((resolve, reject) => {
		if (status === STATUS.UNSTARTED) {
			status = STATUS.STARTED;

			(async () => {
				await FileSys.initRootDir();
				await FileSys.initRootFiles();
				projects = await FileSys.getProjectsData();
				buildIndexData().then(function () {
					resolve(status);
				});
			})();
		} else {
			resolve(status);
		}
	});
}

// EXPORT FUNCTIONS

export default {
	iniateBuild,
	rollTable,
	rollUtility,
	getRoll,
	getRollWithCall,
	getStatus(): STATUS {
		return status;
	},
	getMGeneralIndex(): object {
		return generalIndex;
	},
	getProjects(): projList {
		return projects;
	}
};
