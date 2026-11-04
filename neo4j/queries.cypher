// Create unique users and group memberships during projection sync.
MERGE (u:User {id:$userId}) SET u.name=$name;
// Biggest creditor in one group's projected debt network.
MATCH (u:User)<-[r:OWES {groupId:$groupId}]-(d:User) RETURN u.id AS creditor,sum(r.amount) AS incoming ORDER BY incoming DESC LIMIT 1;
// Biggest debtor.
MATCH (u:User)-[r:OWES {groupId:$groupId}]->(c:User) RETURN u.id AS debtor,sum(r.amount) AS outgoing ORDER BY outgoing DESC LIMIT 1;
// Locate directed cycles (potential offset opportunities) without repeating nodes.
MATCH p=(a:User)-[:OWES*2..8 {groupId:$groupId}]->(a) RETURN p LIMIT 20;
// Shortest payment path.
MATCH p=shortestPath((a:User {id:$from})-[:OWES*..8 {groupId:$groupId}]-(b:User {id:$to})) RETURN p;
// Count projected settlement relationships.
MATCH (:User)-[r:OWES {groupId:$groupId}]->(:User) RETURN count(r) AS simplifiedTransactionCount,sum(r.amount) AS totalAmount;
