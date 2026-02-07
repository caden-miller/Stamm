"""
Ancestry and lineage path finding routes.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import PersonSummary
from db.models import Person, Family, FamilyChild


router = APIRouter(prefix="/api/ancestry", tags=["ancestry"])


def find_parents(person_id: int, db: Session) -> List[int]:
    """Get parent IDs for a person."""
    parents = []

    # Find families where this person is a child
    family_children = db.query(FamilyChild).filter(
        FamilyChild.child_id == person_id
    ).all()

    for fc in family_children:
        family = db.query(Family).filter(Family.id == fc.family_id).first()
        if family:
            if family.husband_id:
                parents.append(family.husband_id)
            if family.wife_id:
                parents.append(family.wife_id)

    return list(set(parents))  # Remove duplicates


def find_children(person_id: int, db: Session) -> List[int]:
    """Get child IDs for a person."""
    children = []

    # Find families where this person is a parent
    families = db.query(Family).filter(
        (Family.husband_id == person_id) | (Family.wife_id == person_id)
    ).all()

    for family in families:
        family_children = db.query(FamilyChild).filter(
            FamilyChild.family_id == family.id
        ).all()
        children.extend([fc.child_id for fc in family_children])

    return list(set(children))  # Remove duplicates


def bfs_path(start_id: int, end_id: int, db: Session) -> Optional[List[int]]:
    """
    Find shortest path between two persons using bidirectional BFS.
    Returns list of person IDs from start to end, or None if no path exists.
    """
    if start_id == end_id:
        return [start_id]

    # Bidirectional BFS
    forward_queue = [(start_id, [start_id])]
    backward_queue = [(end_id, [end_id])]
    forward_visited = {start_id: [start_id]}
    backward_visited = {end_id: [end_id]}

    max_iterations = 1000  # Prevent infinite loops
    iteration = 0

    while forward_queue and backward_queue and iteration < max_iterations:
        iteration += 1

        # Expand from start
        if forward_queue:
            current_id, path = forward_queue.pop(0)

            # Check for meet in middle
            if current_id in backward_visited:
                backward_path = backward_visited[current_id]
                return path + list(reversed(backward_path[:-1]))

            # Explore neighbors (parents and children)
            neighbors = find_parents(current_id, db) + find_children(current_id, db)

            for neighbor_id in neighbors:
                if neighbor_id not in forward_visited:
                    new_path = path + [neighbor_id]
                    forward_visited[neighbor_id] = new_path
                    forward_queue.append((neighbor_id, new_path))

        # Expand from end
        if backward_queue:
            current_id, path = backward_queue.pop(0)

            # Check for meet in middle
            if current_id in forward_visited:
                forward_path = forward_visited[current_id]
                return forward_path + list(reversed(path[:-1]))

            # Explore neighbors (parents and children)
            neighbors = find_parents(current_id, db) + find_children(current_id, db)

            for neighbor_id in neighbors:
                if neighbor_id not in backward_visited:
                    new_path = path + [neighbor_id]
                    backward_visited[neighbor_id] = new_path
                    backward_queue.append((neighbor_id, new_path))

    return None  # No path found


def get_relationship_type(person1_id: int, person2_id: int, db: Session) -> str:
    """Determine the direct relationship between two persons."""
    # Check if person2 is a parent of person1
    parents = find_parents(person1_id, db)
    if person2_id in parents:
        return "parent"

    # Check if person2 is a child of person1
    children = find_children(person1_id, db)
    if person2_id in children:
        return "child"

    # Check if siblings (share at least one parent)
    person1_parents = set(find_parents(person1_id, db))
    person2_parents = set(find_parents(person2_id, db))
    if person1_parents & person2_parents:
        return "sibling"

    # Check if spouses (in same family)
    families1 = db.query(Family).filter(
        (Family.husband_id == person1_id) | (Family.wife_id == person1_id)
    ).all()

    for family in families1:
        if family.husband_id == person2_id or family.wife_id == person2_id:
            return "spouse"

    return "relative"


@router.get("/persons/{person_id}/ancestors")
def get_ancestors(
    person_id: int,
    generations: int = 3,
    db: Session = Depends(get_db)
):
    """
    Get ancestors of a person up to N generations.
    Returns tree structure with persons and relationships.
    """
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    if generations < 1 or generations > 10:
        raise HTTPException(status_code=400, detail="Generations must be between 1 and 10")

    ancestors = {}
    queue = [(person_id, 0)]
    visited = set()

    while queue:
        current_id, gen = queue.pop(0)

        if current_id in visited or gen >= generations:
            continue

        visited.add(current_id)
        current_person = db.query(Person).filter(Person.id == current_id).first()

        if not current_person:
            continue

        # Get parents
        parent_ids = find_parents(current_id, db)
        parents = []

        for parent_id in parent_ids:
            parent = db.query(Person).filter(Person.id == parent_id).first()
            if parent:
                parents.append({
                    "id": parent.id,
                    "gedcom_id": parent.gedcom_id,
                    "first_name": parent.first_name,
                    "last_name": parent.last_name,
                    "display_name": parent.display_name,
                    "sex": parent.sex,
                })
                queue.append((parent_id, gen + 1))

        ancestors[current_id] = {
            "id": current_person.id,
            "gedcom_id": current_person.gedcom_id,
            "first_name": current_person.first_name,
            "last_name": current_person.last_name,
            "display_name": current_person.display_name,
            "sex": current_person.sex,
            "generation": gen,
            "parents": parents,
        }

    return {
        "root_person_id": person_id,
        "root_person_name": person.display_name,
        "generations": generations,
        "ancestors": list(ancestors.values()),
    }


@router.get("/persons/{person_id}/descendants")
def get_descendants(
    person_id: int,
    generations: int = 3,
    db: Session = Depends(get_db)
):
    """
    Get descendants of a person up to N generations.
    Returns tree structure with persons and relationships.
    """
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    if generations < 1 or generations > 10:
        raise HTTPException(status_code=400, detail="Generations must be between 1 and 10")

    descendants = {}
    queue = [(person_id, 0)]
    visited = set()

    while queue:
        current_id, gen = queue.pop(0)

        if current_id in visited or gen >= generations:
            continue

        visited.add(current_id)
        current_person = db.query(Person).filter(Person.id == current_id).first()

        if not current_person:
            continue

        # Get children
        child_ids = find_children(current_id, db)
        children = []

        for child_id in child_ids:
            child = db.query(Person).filter(Person.id == child_id).first()
            if child:
                children.append({
                    "id": child.id,
                    "gedcom_id": child.gedcom_id,
                    "first_name": child.first_name,
                    "last_name": child.last_name,
                    "display_name": child.display_name,
                    "sex": child.sex,
                })
                queue.append((child_id, gen + 1))

        descendants[current_id] = {
            "id": current_person.id,
            "gedcom_id": current_person.gedcom_id,
            "first_name": current_person.first_name,
            "last_name": current_person.last_name,
            "display_name": current_person.display_name,
            "sex": current_person.sex,
            "generation": gen,
            "children": children,
        }

    return {
        "root_person_id": person_id,
        "root_person_name": person.display_name,
        "generations": generations,
        "descendants": list(descendants.values()),
    }


@router.get("/persons/{person1_id}/path/{person2_id}")
def get_relationship_path(
    person1_id: int,
    person2_id: int,
    db: Session = Depends(get_db)
):
    """
    Find the shortest relationship path between two persons.
    Returns the path as a list of persons with relationship types.
    """
    person1 = db.query(Person).filter(Person.id == person1_id).first()
    person2 = db.query(Person).filter(Person.id == person2_id).first()

    if not person1:
        raise HTTPException(status_code=404, detail=f"Person {person1_id} not found")
    if not person2:
        raise HTTPException(status_code=404, detail=f"Person {person2_id} not found")

    # Find shortest path
    path_ids = bfs_path(person1_id, person2_id, db)

    if not path_ids:
        return {
            "person1_id": person1_id,
            "person1_name": person1.display_name,
            "person2_id": person2_id,
            "person2_name": person2.display_name,
            "path_found": False,
            "path": [],
            "relationship_description": "No direct relationship found",
        }

    # Build path with persons and relationships
    path = []
    for i, pid in enumerate(path_ids):
        p = db.query(Person).filter(Person.id == pid).first()
        if not p:
            continue

        relationship = None
        if i < len(path_ids) - 1:
            next_id = path_ids[i + 1]
            relationship = get_relationship_type(pid, next_id, db)

        path.append({
            "id": p.id,
            "gedcom_id": p.gedcom_id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "display_name": p.display_name,
            "sex": p.sex,
            "relationship_to_next": relationship,
        })

    # Generate relationship description
    if len(path_ids) == 1:
        description = "Same person"
    elif len(path_ids) == 2:
        rel = path[0]["relationship_to_next"]
        description = rel.capitalize()
    else:
        description = f"{len(path_ids) - 1} degrees of separation"

    return {
        "person1_id": person1_id,
        "person1_name": person1.display_name,
        "person2_id": person2_id,
        "person2_name": person2.display_name,
        "path_found": True,
        "path_length": len(path_ids),
        "path": path,
        "relationship_description": description,
    }
